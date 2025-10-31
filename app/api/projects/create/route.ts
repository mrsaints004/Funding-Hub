import { NextResponse } from "next/server";

type CreateProjectRequest = {
  projectId: string;
  projectName: string;
  badgeSymbol: string;
  badgeUri: string;
  targetAmount: string;
  deadline: string;
  mint: string;
};

export async function POST(request: Request) {
  const body = (await request.json()) as CreateProjectRequest;

  if (!body.projectId || !body.projectName || !body.badgeSymbol || !body.badgeUri) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  // TODO: Build Anchor transaction using IDL + wallet adapter once runtime integration is wired.
  // For now, return a placeholder instruction that the client can inspect.
  const draft = {
    serialized: Buffer.from(
      JSON.stringify({
        program: "funding_hub",
        accounts: body,
      })
    ).toString("base64"),
    encoding: "base64" as const,
  };

  return NextResponse.json(draft, { status: 200 });
}
