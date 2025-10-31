import { NextRequest, NextResponse } from "next/server";
import { submitProject } from "@/lib/storage";

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);

  if (!body) {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { title, summary, description, fundingGoal, fundingMint, metadataUri, proposer } = body;

  if (!title || !summary || !description || !fundingGoal || !fundingMint || !proposer) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const goalNumber = Number(fundingGoal);
  if (!Number.isFinite(goalNumber) || goalNumber <= 0) {
    return NextResponse.json({ error: "Funding goal must be a positive number" }, { status: 400 });
  }

  const project = await submitProject({
    title,
    summary,
    description,
    fundingGoal: goalNumber,
    fundingMint,
    metadataUri,
    proposer
  });

  return NextResponse.json({ project }, { status: 201 });
}
