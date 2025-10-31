import { NextRequest, NextResponse } from "next/server";

const JUPITER_QUOTE_API = "https://quote-api.jup.ag/v6/quote";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!body?.inputMint || !body?.outputMint || !body?.amount) {
    return NextResponse.json({ error: "Missing swap parameters" }, { status: 400 });
  }

  const amount = Number(body.amount);
  if (!Number.isFinite(amount) || amount <= 0) {
    return NextResponse.json({ error: "Amount must be positive" }, { status: 400 });
  }

  // Convert amount to lamports/base units (assuming 9 decimals for SOL/USDC)
  const decimals = body.decimals || 9;
  const amountInBaseUnits = Math.floor(amount * Math.pow(10, decimals));

  try {
    // Call Jupiter Quote API for real pricing
    const quoteUrl = new URL(JUPITER_QUOTE_API);
    quoteUrl.searchParams.set("inputMint", body.inputMint);
    quoteUrl.searchParams.set("outputMint", body.outputMint);
    quoteUrl.searchParams.set("amount", amountInBaseUnits.toString());
    quoteUrl.searchParams.set("slippageBps", body.slippageBps || "50"); // 0.5% default

    const response = await fetch(quoteUrl.toString());

    if (!response.ok) {
      throw new Error(`Jupiter API error: ${response.status}`);
    }

    const jupiterQuote = await response.json();

    // Convert output amount back to human-readable
    const outDecimals = body.outDecimals || 9;
    const estimatedOut = Number(jupiterQuote.outAmount) / Math.pow(10, outDecimals);
    const price = estimatedOut / amount;

    return NextResponse.json({
      inputMint: body.inputMint,
      outputMint: body.outputMint,
      amountIn: amount,
      estimatedOut: Number(estimatedOut.toFixed(6)),
      price: Number(price.toFixed(6)),
      priceImpactPct: jupiterQuote.priceImpactPct,
      jupiterQuote: jupiterQuote, // Return full quote for swap execution
    });
  } catch (error) {
    console.error("Jupiter quote error:", error);
    // Fallback to simple mock pricing if Jupiter fails
    const FALLBACK_PRICE = 180;
    const outAmount = amount * FALLBACK_PRICE;

    return NextResponse.json({
      inputMint: body.inputMint,
      outputMint: body.outputMint,
      amountIn: amount,
      estimatedOut: Number(outAmount.toFixed(6)),
      price: FALLBACK_PRICE,
      fallback: true,
      error: (error as Error).message
    });
  }
}
