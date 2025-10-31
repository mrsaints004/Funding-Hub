import { NextRequest, NextResponse } from "next/server";

const INDEXER_URL = process.env.INDEXER_URL ?? process.env.NEXT_PUBLIC_INDEXER_URL;

export async function GET(_request: NextRequest, context: { params: { path?: string[] } }) {
  if (!INDEXER_URL) {
    return NextResponse.json({ error: "INDEXER_URL not configured" }, { status: 503 });
  }

  const suffix = context.params.path?.join("/") ?? "";
  const url = new URL(`/${suffix}`, INDEXER_URL).toString();

  try {
    const res = await fetch(url, { cache: "no-store" });
    const text = await res.text();
    return new NextResponse(text, {
      status: res.status,
      headers: {
        "content-type": res.headers.get("content-type") ?? "application/json"
      }
    });
  } catch (error) {
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 502 }
    );
  }
}
