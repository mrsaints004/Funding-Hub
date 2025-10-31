import { NextRequest, NextResponse } from "next/server";
import { Connection, PublicKey, VersionedTransaction } from "@solana/web3.js";

const JUPITER_SWAP_API = "https://quote-api.jup.ag/v6/swap";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);

  if (!body?.jupiterQuote || !body?.userPublicKey || !body?.daoAddress) {
    return NextResponse.json(
      { error: "Missing jupiterQuote, userPublicKey, or daoAddress" },
      { status: 400 }
    );
  }

  try {
    const connection = new Connection(
      process.env.NEXT_PUBLIC_RPC_ENDPOINT || "https://api.mainnet-beta.solana.com"
    );

    // Verify user is a DAO member
    const daoMembership = await verifyDaoMembership(
      connection,
      new PublicKey(body.userPublicKey),
      new PublicKey(body.daoAddress)
    );

    if (!daoMembership) {
      return NextResponse.json(
        { error: "User is not a member of the specified DAO. Gas sponsorship unavailable." },
        { status: 403 }
      );
    }

    // Build the swap transaction using Jupiter
    const swapResponse = await fetch(JUPITER_SWAP_API, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        quoteResponse: body.jupiterQuote,
        userPublicKey: body.userPublicKey,
        wrapAndUnwrapSol: true,
        dynamicComputeUnitLimit: true,
        prioritizationFeeLamports: "auto",
      }),
    });

    if (!swapResponse.ok) {
      throw new Error(`Jupiter swap API error: ${swapResponse.status}`);
    }

    const { swapTransaction } = await swapResponse.json();

    // Prepare transaction for relay
    return NextResponse.json({
      success: true,
      serializedTransaction: swapTransaction,
      daoAddress: body.daoAddress,
      message: "Transaction ready for gas-sponsored execution. Submit to relayer.",
    });
  } catch (error) {
    console.error("Swap execution error:", error);
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 500 }
    );
  }
}

/**
 * Verify if a user holds a DAO pass NFT
 */
async function verifyDaoMembership(
  connection: Connection,
  userPubkey: PublicKey,
  daoAddress: PublicKey
): Promise<boolean> {
  try {
    // Get the DAO account to retrieve the pass mint
    const daoAccountInfo = await connection.getAccountInfo(daoAddress);

    if (!daoAccountInfo) {
      return false;
    }

    // Parse DAO account to get pass_mint (offset based on dao_pass program structure)
    // Discriminator (8) + authority (32) = 40 bytes, then pass_mint at 40
    const passMint = new PublicKey(daoAccountInfo.data.slice(40, 72));

    // Check if user has token account with balance > 0 for this mint
    const tokenAccounts = await connection.getTokenAccountsByOwner(userPubkey, {
      mint: passMint,
    });

    if (tokenAccounts.value.length === 0) {
      return false;
    }

    // Verify balance > 0 (user holds at least 1 DAO pass NFT)
    const accountData = tokenAccounts.value[0].account.data;
    const amount = accountData.readBigUInt64LE(64); // Token amount at offset 64

    return amount > 0n;
  } catch (error) {
    console.error("DAO membership verification error:", error);
    return false;
  }
}
