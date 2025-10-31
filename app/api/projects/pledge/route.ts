import { NextResponse } from "next/server";

type PledgeRequest = {
  projectId: string;
  amount: string;
};

export async function POST(request: Request) {
  const body = (await request.json()) as PledgeRequest;
  if (!body.projectId || !body.amount) {
    return NextResponse.json({ error: "Missing projectId or amount" }, { status: 400 });
  }

  // TODO: Use Anchor + SPL Token libraries to build pledge transaction with donor badge ATA creation
  const draft = {
    projectId: body.projectId,
    amount: body.amount,
    relayEndpoint: "/api/relayer",
    message: "Serialize Anchor transaction client-side and send to relayer",
  };

  return NextResponse.json(draft, { status: 200 });
}
