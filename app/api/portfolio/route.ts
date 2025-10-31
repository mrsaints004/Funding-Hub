import { NextRequest, NextResponse } from "next/server";
import { Connection, PublicKey } from "@solana/web3.js";
import { getPortfolioSummary } from "../../../lib/portfolioAnalytics";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const walletAddress = searchParams.get("wallet");

  if (!walletAddress) {
    return NextResponse.json({ error: "Missing wallet parameter" }, { status: 400 });
  }

  try {
    const publicKey = new PublicKey(walletAddress);
    const connection = new Connection(
      process.env.NEXT_PUBLIC_RPC_ENDPOINT || "https://api.mainnet-beta.solana.com",
      "confirmed"
    );

    const portfolio = await getPortfolioSummary(connection, publicKey);

    return NextResponse.json(portfolio);
  } catch (error) {
    console.error("Portfolio fetch error:", error);
    return NextResponse.json(
      { error: (error as Error).message || "Failed to fetch portfolio" },
      { status: 500 }
    );
  }
}
