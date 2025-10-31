const anchor = require("@project-serum/anchor");
const assert = require("assert");
const {
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  createMint,
  getOrCreateAssociatedTokenAccount,
  mintTo,
  getAccount,
  getAssociatedTokenAddressSync
} = require("@solana/spl-token");

const { SystemProgram, SYSVAR_RENT_PUBKEY, PublicKey, LAMPORTS_PER_SOL } = anchor.web3;

const TOKEN_METADATA_PROGRAM_ID = new PublicKey(
  "metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s"
);

describe("funding_hub", () => {
  const provider = anchor.AnchorProvider.local();
  anchor.setProvider(provider);

  const program = anchor.workspace.FundingHub;
  const authority = provider.wallet;

  const projectId = new anchor.BN(1);
  const targetAmount = new anchor.BN(1_000_000);
  const pledgeAmount = new anchor.BN(1_000_000);
  const deadlineTs = new anchor.BN(Math.floor(Date.now() / 1000) + 600);

  let depositMint;
  let donor;
  let donorDepositAta;
  let authorityDepositAta;
  let badgeMintKeypair;
  let badgeMetadataPda;
  let projectPda;
  let projectVaultAta;

  before(async () => {
    const connection = provider.connection;

    depositMint = await createMint(
      connection,
      authority.payer,
      authority.publicKey,
      null,
      6
    );

    donor = anchor.web3.Keypair.generate();
    await connection.confirmTransaction(
      await connection.requestAirdrop(donor.publicKey, 2 * LAMPORTS_PER_SOL)
    );

    const donorAta = await getOrCreateAssociatedTokenAccount(
      connection,
      authority.payer,
      depositMint,
      donor.publicKey,
      false,
      "confirmed",
      { commitment: "confirmed" }
    );
    donorDepositAta = donorAta.address;

    const authorityAta = await getOrCreateAssociatedTokenAccount(
      connection,
      authority.payer,
      depositMint,
      authority.publicKey
    );
    authorityDepositAta = authorityAta.address;

    const pledgeAmountNumber = pledgeAmount.toNumber();

    await mintTo(
      connection,
      authority.payer,
      depositMint,
      donorDepositAta,
      authority.publicKey,
      pledgeAmountNumber * 2
    );

    const projectSeed = Buffer.from("project");
    const projectIdBytes = projectId.toArray("le", 8);
    [projectPda] = PublicKey.findProgramAddressSync(
      [projectSeed, authority.publicKey.toBuffer(), Buffer.from(projectIdBytes)],
      program.programId
    );

    projectVaultAta = getAssociatedTokenAddressSync(
      depositMint,
      projectPda,
      true
    );

    badgeMintKeypair = anchor.web3.Keypair.generate();
    [badgeMetadataPda] = PublicKey.findProgramAddressSync(
      [
        Buffer.from("metadata"),
        TOKEN_METADATA_PROGRAM_ID.toBuffer(),
        badgeMintKeypair.publicKey.toBuffer()
      ],
      TOKEN_METADATA_PROGRAM_ID
    );

    await program.methods
      .initializeProject(
        projectId,
        targetAmount,
        deadlineTs,
        "Alpha Labs",
        "ALPHA",
        "https://example.com/alpha.json"
      )
      .accounts({
        authority: authority.publicKey,
        project: projectPda,
        mint: depositMint,
        projectVault: projectVaultAta,
        badgeMint: badgeMintKeypair.publicKey,
        badgeMetadata: badgeMetadataPda,
        systemProgram: SystemProgram.programId,
        tokenProgram: TOKEN_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        tokenMetadataProgram: TOKEN_METADATA_PROGRAM_ID,
        rent: SYSVAR_RENT_PUBKEY
      })
      .signers([badgeMintKeypair])
      .rpc();
  });

  it("accepts pledges and mints donor badge", async () => {
    const donorBadgeAta = getAssociatedTokenAddressSync(
      badgeMintKeypair.publicKey,
      donor.publicKey
    );

    await program.methods
      .pledge(pledgeAmount)
      .accounts({
        donor: donor.publicKey,
        donorTokenAccount: donorDepositAta,
        project: projectPda,
        projectVault: projectVaultAta,
        badgeMint: badgeMintKeypair.publicKey,
        donorBadgeAccount: donorBadgeAta,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        rent: SYSVAR_RENT_PUBKEY
      })
      .signers([donor])
      .rpc();

    const donorBadgeAccount = await getAccount(provider.connection, donorBadgeAta);
    assert.strictEqual(Number(donorBadgeAccount.amount), 1, "badge not minted");

    const projectAccount = await program.account.project.fetch(projectPda);
    assert.strictEqual(projectAccount.totalPledged.toNumber(), pledgeAmount.toNumber());
  });

  it("finalizes and withdraws funds", async () => {
    await program.methods
      .finalizeProject()
      .accounts({
        authority: authority.publicKey,
        project: projectPda
      })
      .rpc();

    await program.methods
      .withdraw(pledgeAmount)
      .accounts({
        authority: authority.publicKey,
        project: projectPda,
        projectVault: projectVaultAta,
        authorityTokenAccount: authorityDepositAta,
        tokenProgram: TOKEN_PROGRAM_ID
      })
      .rpc();

    const authorityAccount = await getAccount(provider.connection, authorityDepositAta);
    assert.strictEqual(Number(authorityAccount.amount), pledgeAmountNumber);
  });
});
