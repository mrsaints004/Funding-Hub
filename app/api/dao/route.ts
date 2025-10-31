import { NextResponse } from "next/server";
import { fetchIndexer } from "../../../lib/indexer";

const FALLBACK = {
  daos: [
    {
      daoId: "alpha-dao",
      name: "AlphaDAO",
      passMint: "DaopassMint1111111111111111111111111111111",
      sponsorVault: "SponsorVaultAlpha11111111111111111111111",
      maxRelaySpend: "5,000 SOL (per 12h)",
      relaySpent: "1,240 SOL",
      members: 812
    },
    {
      daoId: "planet-guild",
      name: "Planetary Guild",
      passMint: "PassMintPlanet111111111111111111111111111",
      sponsorVault: "SponsorVaultPlanet1111111111111111111",
      maxRelaySpend: "3,500 SOL",
      relaySpent: "2,910 SOL",
      members: 452
    }
  ]
};

export async function GET() {
  const data = await fetchIndexer({ path: "/daos", fallback: FALLBACK });
  return NextResponse.json(data);
}
