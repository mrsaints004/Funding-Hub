import { NextResponse } from "next/server";
import { fetchIndexer } from "../../../lib/indexer";

const FALLBACK = {
  proposals: [
    {
      proposalId: "alpha-42",
      realm: "AlphaDAO",
      title: "Adopt fee-sponsorship policy 2.0",
      status: "Pending",
      votingStart: "Jan 10, 2025",
      votingEnd: "Jan 13, 2025",
      yesVotes: "120k",
      noVotes: "8k",
      quorum: "Reached (78%)"
    },
    {
      proposalId: "builders-11",
      realm: "Builders Collective",
      title: "Allocate 100k USDC to scholarships",
      status: "Succeeded",
      votingStart: "Dec 12, 2024",
      votingEnd: "Dec 15, 2024",
      yesVotes: "230k",
      noVotes: "17k",
      quorum: "Reached (92%)"
    }
  ]
};

export async function GET() {
  const data = await fetchIndexer({ path: "/governance", fallback: FALLBACK });
  return NextResponse.json(data);
}
