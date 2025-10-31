import { AnchorProvider, BN, Idl, Program } from "@coral-xyz/anchor";
import { Buffer } from "buffer";
import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
  createAssociatedTokenAccountInstruction,
  getAssociatedTokenAddressSync
} from "@solana/spl-token";
import {
  Connection,
  Keypair,
  PublicKey,
  SYSVAR_INSTRUCTIONS_PUBKEY,
  SYSVAR_RENT_PUBKEY,
  SystemProgram,
  Transaction,
  TransactionInstruction
} from "@solana/web3.js";
import { WalletContextState } from "@solana/wallet-adapter-react";

import fundingHubIdl from "../idl/funding_hub.json";
import {
  FUNDING_HUB_PROGRAM_ID,
  TOKEN_METADATA_PROGRAM_ID
} from "./constants";

type FundingHubIdl = typeof fundingHubIdl & Idl;

export type InitializeProjectParams = {
  connection: Connection;
  wallet: WalletContextState;
  projectId: number | bigint | string;
  projectName: string;
  badgeSymbol: string;
  badgeUri: string;
  targetAmount: number | bigint | string;
  deadlineTs: number | bigint | string;
  mint: string | PublicKey;
};

export type InitializeProjectResult = {
  transaction: Transaction;
  badgeMint: PublicKey;
  project: PublicKey;
  projectVault: PublicKey;
  badgeMetadata: PublicKey;
};

export async function buildInitializeProjectTx({
  connection,
  wallet,
  projectId,
  projectName,
  badgeSymbol,
  badgeUri,
  targetAmount,
  deadlineTs,
  mint
}: InitializeProjectParams): Promise<InitializeProjectResult> {
  const provider = createAnchorProvider(connection, wallet);
  const program = new Program<FundingHubIdl>(fundingHubIdl as FundingHubIdl, provider);

  const authority = ensurePublicKey(wallet);
  const projectIdBn = new BN(projectId.toString());
  const targetAmountBn = new BN(targetAmount.toString());
  const deadlineBn = new BN(deadlineTs.toString());
  const mintKey = typeof mint === "string" ? new PublicKey(mint) : mint;

  const projectIdBuffer = Buffer.alloc(8);
  projectIdBuffer.writeBigUInt64LE(BigInt(projectIdBn.toString()));

  const [projectPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("project"), authority.toBuffer(), projectIdBuffer],
    FUNDING_HUB_PROGRAM_ID
  );

  const projectVault = getAssociatedTokenAddressSync(mintKey, projectPda, true);

  const badgeMint = Keypair.generate();
  const [badgeMetadata] = PublicKey.findProgramAddressSync(
    [Buffer.from("metadata"), TOKEN_METADATA_PROGRAM_ID.toBuffer(), badgeMint.publicKey.toBuffer()],
    TOKEN_METADATA_PROGRAM_ID
  );

  const tx = await program.methods
    .initializeProject(projectIdBn, targetAmountBn, deadlineBn, projectName, badgeSymbol, badgeUri)
    .accounts({
      authority,
      project: projectPda,
      mint: mintKey,
      projectVault,
      badgeMint: badgeMint.publicKey,
      badgeMetadata,
      systemProgram: SystemProgram.programId,
      tokenProgram: TOKEN_PROGRAM_ID,
      associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
      tokenMetadataProgram: TOKEN_METADATA_PROGRAM_ID,
      rent: SYSVAR_RENT_PUBKEY,
      sysvarInstructions: SYSVAR_INSTRUCTIONS_PUBKEY
    })
    .transaction();

  const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
  tx.recentBlockhash = blockhash;
  tx.lastValidBlockHeight = lastValidBlockHeight;
  tx.feePayer = authority;
  tx.partialSign(badgeMint);

  return {
    transaction: tx,
    badgeMint: badgeMint.publicKey,
    project: projectPda,
    projectVault,
    badgeMetadata
  };
}

export type BuildPledgeParams = {
  connection: Connection;
  wallet: WalletContextState;
  project: string | PublicKey;
  amount: number | bigint | string;
};

export type BuildPledgeResult = {
  transaction: Transaction;
  project: PublicKey;
  donorTokenAccount: PublicKey;
  donorBadgeAccount: PublicKey;
};

export async function buildPledgeTx({
  connection,
  wallet,
  project,
  amount
}: BuildPledgeParams): Promise<BuildPledgeResult> {
  const provider = createAnchorProvider(connection, wallet);
  const program = new Program<FundingHubIdl>(fundingHubIdl as FundingHubIdl, provider);

  const projectPubkey = typeof project === "string" ? new PublicKey(project) : project;
  // @ts-ignore - TypeScript can't infer account types from JSON IDL in Anchor 0.30.1
  const projectAccount = await (program.account as any).Project.fetch(projectPubkey);

  const donor = ensurePublicKey(wallet);
  const projectMint = new PublicKey(projectAccount.mint);
  const projectVault = new PublicKey(projectAccount.vault);
  const badgeMint = new PublicKey(projectAccount.badgeMint);

  const donorTokenAccount = getAssociatedTokenAddressSync(projectMint, donor);
  const donorBadgeAccount = getAssociatedTokenAddressSync(badgeMint, donor);

  const setupInstructions: TransactionInstruction[] = [];
  const donorAccountInfo = await connection.getAccountInfo(donorTokenAccount);
  if (!donorAccountInfo) {
    setupInstructions.push(
      createAssociatedTokenAccountInstruction(donor, donorTokenAccount, donor, projectMint)
    );
  }

  const pledgeInstruction = await program.methods
    .pledge(new BN(amount.toString()))
    .accounts({
      donor,
      donorTokenAccount,
      project: projectPubkey,
      projectVault,
      badgeMint,
      donorBadgeAccount,
      tokenProgram: TOKEN_PROGRAM_ID,
      systemProgram: SystemProgram.programId,
      associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
      rent: SYSVAR_RENT_PUBKEY
    })
    .instruction();

  const tx = new Transaction();
  setupInstructions.forEach((ix) => tx.add(ix));
  tx.add(pledgeInstruction);

  const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
  tx.recentBlockhash = blockhash;
  tx.lastValidBlockHeight = lastValidBlockHeight;
  tx.feePayer = donor;

  return {
    transaction: tx,
    project: projectPubkey,
    donorTokenAccount,
    donorBadgeAccount
  };
}

export async function buildDaoSponsorDepositTx({
  connection,
  wallet,
  sponsorVault,
  amount
}: {
  connection: Connection;
  wallet: WalletContextState;
  sponsorVault: string | PublicKey;
  amount: number | bigint | string;
}): Promise<Transaction> {
  const payer = ensurePublicKey(wallet);
  const vaultKey = typeof sponsorVault === "string" ? new PublicKey(sponsorVault) : sponsorVault;
  const lamports = BigInt(amount.toString());
  if (lamports <= 0) {
    throw new Error("Amount must be positive");
  }

  const tx = new Transaction().add(
    SystemProgram.transfer({
      fromPubkey: payer,
      toPubkey: vaultKey,
      lamports: Number(lamports)
    })
  );

  const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
  tx.recentBlockhash = blockhash;
  tx.lastValidBlockHeight = lastValidBlockHeight;
  tx.feePayer = payer;

  return tx;
}

function createAnchorProvider(connection: Connection, wallet: WalletContextState): AnchorProvider {
  if (!wallet.signTransaction || !wallet.signAllTransactions) {
    throw new Error("Wallet adapter is missing signTransaction/signAllTransactions implementations");
  }
  const publicKey = wallet.publicKey;
  if (!publicKey) {
    throw new Error("Wallet not connected");
  }

  const anchorWallet = {
    publicKey,
    signTransaction: wallet.signTransaction.bind(wallet),
    signAllTransactions: wallet.signAllTransactions.bind(wallet)
  };

  return new AnchorProvider(connection, anchorWallet, AnchorProvider.defaultOptions());
}

function ensurePublicKey(wallet: WalletContextState): PublicKey {
  if (!wallet.publicKey) {
    throw new Error("Wallet not connected");
  }
  return wallet.publicKey;
}
