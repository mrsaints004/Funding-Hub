import { NextRequest, NextResponse } from "next/server";

const RELAYER_URL = process.env.RELAYER_URL ?? process.env.NEXT_PUBLIC_RELAYER_URL;

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);

  if (!body?.serializedTransaction) {
    return NextResponse.json({ error: "Missing serializedTransaction" }, { status: 400 });
  }

  if (!RELAYER_URL) {
    return NextResponse.json({ warning: "RELAYER_URL not configured", payload: body }, { status: 202 });
  }

  try {
    const forward = await fetch(RELAYER_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });

    const payload = await forward.json().catch(() => ({}));
    return NextResponse.json(payload, { status: forward.status });
  } catch (error) {
    return NextResponse.json(
      { error: (error as Error).message, payload: body },
      { status: 502 }
    );
  }
}
