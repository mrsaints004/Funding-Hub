import { NextResponse } from "next/server";
import { fetchIndexer } from "../../../lib/indexer";

const FALLBACK = {
  vaults: [
    {
      vaultId: "vault-3m",
      term: "3 Months",
      apy: "6.8% APY",
      depositMint: "USDC",
      rewardMint: "HUB",
      tvl: "$210k",
      unlockDate: "Apr 12, 2025"
    },
    {
      vaultId: "vault-6m",
      term: "6 Months",
      apy: "9.4% APY",
      depositMint: "USDC",
      rewardMint: "HUB",
      tvl: "$360k",
      unlockDate: "Jul 12, 2025"
    },
    {
      vaultId: "vault-12m",
      term: "12 Months",
      apy: "13.2% APY",
      depositMint: "USDC",
      rewardMint: "HUB",
      tvl: "$590k",
      unlockDate: "Jan 12, 2026"
    }
  ]
};

export async function GET() {
  const data = await fetchIndexer({ path: "/savings", fallback: FALLBACK });
  return NextResponse.json(data);
}
