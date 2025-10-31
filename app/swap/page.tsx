"use client";

import { useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { WalletButton } from "../../components/WalletButton";

const TOKENS = [
  { symbol: "SOL", mint: "So11111111111111111111111111111111111111112", decimals: 9 },
  { symbol: "USDC", mint: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v", decimals: 6 },
  { symbol: "USDT", mint: "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB", decimals: 6 }
];

type Quote = {
  inputMint: string;
  outputMint: string;
  amountIn: number;
  estimatedOut: number;
  price: number;
  priceImpactPct?: number;
  jupiterQuote?: any;
  fallback?: boolean;
};

export default function SwapPage() {
  const { publicKey, signTransaction } = useWallet();
  const [inputMint, setInputMint] = useState(TOKENS[0].mint);
  const [outputMint, setOutputMint] = useState(TOKENS[1].mint);
  const [amount, setAmount] = useState("1");
  const [daoAddress, setDaoAddress] = useState("");
  const [quote, setQuote] = useState<Quote | null>(null);
  const [loading, setLoading] = useState(false);
  const [executing, setExecuting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handleSwap = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setQuote(null);
    setError(null);
    setSuccess(null);
    try {
      const inputToken = TOKENS.find((t) => t.mint === inputMint);
      const outputToken = TOKENS.find((t) => t.mint === outputMint);

      const res = await fetch("/api/swap/quote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          inputMint,
          outputMint,
          amount: Number(amount),
          decimals: inputToken?.decimals || 9,
          outDecimals: outputToken?.decimals || 9,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `Quote failed (${res.status})`);
      }
      const json = (await res.json()) as Quote;
      setQuote(json);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const handleExecuteSwap = async () => {
    if (!quote || !publicKey || !daoAddress) {
      setError("Missing quote, wallet connection, or DAO address");
      return;
    }

    setExecuting(true);
    setError(null);
    setSuccess(null);

    try {
      // Step 1: Build swap transaction
      const buildRes = await fetch("/api/swap/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jupiterQuote: quote.jupiterQuote,
          userPublicKey: publicKey.toString(),
          daoAddress,
        }),
      });

      if (!buildRes.ok) {
        const body = await buildRes.json().catch(() => ({}));
        throw new Error(body.error ?? `Swap build failed (${buildRes.status})`);
      }

      const { serializedTransaction } = await buildRes.json();

      // Step 2: Submit to relayer for gas-sponsored execution
      const relayRes = await fetch("/api/relayer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          dao: daoAddress,
          serializedTransaction,
          encoding: "base64",
        }),
      });

      if (!relayRes.ok) {
        const body = await relayRes.json().catch(() => ({}));
        throw new Error(body.error ?? `Relayer failed (${relayRes.status})`);
      }

      const { signature } = await relayRes.json();
      setSuccess(`Swap executed! Signature: ${signature}`);
      setQuote(null);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setExecuting(false);
    }
  };

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-8">
      <header className="rounded-2xl border border-slate-800/70 bg-slate-900/40 px-6 py-8 backdrop-blur">
        <div className="flex items-center justify-between">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-primary/40 bg-primary/10 px-4 py-1 text-[11px] uppercase tracking-[0.25em] text-primary">
              Swap
            </div>
            <h2 className="mt-4 text-3xl font-semibold text-slate-50">Gas-Sponsored Swaps</h2>
            <p className="mt-2 text-sm text-slate-400">
              DAO members can swap tokens without paying gas fees. Connect your wallet and provide your DAO address to execute sponsored swaps.
            </p>
          </div>
          <WalletButton />
        </div>
      </header>

      <form
        onSubmit={handleSwap}
        className="space-y-5 rounded-2xl border border-slate-800/70 bg-slate-950/50 px-6 py-8 shadow-[0_30px_60px_-45px_rgba(20,241,149,0.45)] backdrop-blur"
      >
        <div className="grid gap-4 md:grid-cols-2">
          <SelectField
            label="From"
            value={inputMint}
            onChange={setInputMint}
            options={TOKENS.filter((token) => token.mint !== outputMint)}
          />
          <SelectField
            label="To"
            value={outputMint}
            onChange={setOutputMint}
            options={TOKENS.filter((token) => token.mint !== inputMint)}
          />
        </div>
        <label className="grid gap-2 text-xs uppercase text-slate-500">
          Amount
          <input
            type="number"
            min="0"
            step="0.000001"
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            className="rounded-xl border border-slate-800 bg-slate-900/50 px-4 py-3 text-sm text-slate-100 focus:border-accent"
            required
          />
        </label>
        <label className="grid gap-2 text-xs uppercase text-slate-500">
          DAO Address (for gas sponsorship)
          <input
            type="text"
            value={daoAddress}
            onChange={(event) => setDaoAddress(event.target.value)}
            placeholder="Enter your DAO address"
            className="rounded-xl border border-slate-800 bg-slate-900/50 px-4 py-3 text-sm text-slate-100 focus:border-accent font-mono"
          />
        </label>
        <button
          type="submit"
          disabled={loading}
          className="inline-flex items-center justify-center rounded-full bg-gradient-to-r from-accent via-primary to-accent px-6 py-3 text-sm font-semibold text-slate-950 shadow-lg transition hover:shadow-[0_20px_45px_-25px_rgba(20,241,149,0.55)] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? "Fetching quote…" : "Get Quote"}
        </button>
        {error && <p className="text-sm text-red-400">{error}</p>}
        {success && <p className="text-sm text-green-400">{success}</p>}
      </form>

      {quote && (
        <section className="rounded-2xl border border-slate-800/70 bg-slate-950/50 px-6 py-6 text-sm text-slate-300 backdrop-blur">
          <h3 className="text-lg font-semibold text-slate-100">Quote Details</h3>
          {quote.fallback && (
            <p className="mt-2 text-xs text-yellow-400">⚠️ Using fallback pricing. Jupiter API unavailable.</p>
          )}
          <dl className="mt-4 grid grid-cols-2 gap-3">
            <div>
              <dt className="text-xs uppercase tracking-[0.25em] text-slate-500">Amount In</dt>
              <dd className="text-slate-100">{quote.amountIn}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-[0.25em] text-slate-500">Est. Out</dt>
              <dd className="text-slate-100">{quote.estimatedOut}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-[0.25em] text-slate-500">Price</dt>
              <dd className="text-accent">{quote.price}</dd>
            </div>
            {quote.priceImpactPct && (
              <div>
                <dt className="text-xs uppercase tracking-[0.25em] text-slate-500">Price Impact</dt>
                <dd className="text-slate-100">{quote.priceImpactPct}%</dd>
              </div>
            )}
          </dl>
          {!quote.fallback && quote.jupiterQuote && publicKey && daoAddress && (
            <button
              onClick={handleExecuteSwap}
              disabled={executing}
              className="mt-6 inline-flex w-full items-center justify-center rounded-full bg-gradient-to-r from-primary to-accent px-6 py-3 text-sm font-semibold text-slate-950 shadow-lg transition hover:shadow-[0_20px_45px_-25px_rgba(20,241,149,0.55)] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {executing ? "Executing swap..." : "Execute Gas-Sponsored Swap"}
            </button>
          )}
          {!publicKey && (
            <p className="mt-4 text-xs text-yellow-400">Connect your wallet to execute swaps</p>
          )}
          {!daoAddress && publicKey && (
            <p className="mt-4 text-xs text-yellow-400">Enter a DAO address to enable gas sponsorship</p>
          )}
          {quote.fallback && (
            <p className="mt-4 text-xs text-slate-500">
              Fallback quote cannot be executed. Please try again when Jupiter API is available.
            </p>
          )}
        </section>
      )}
    </div>
  );
}

type SelectFieldProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: { symbol: string; mint: string }[];
};

function SelectField({ label, value, onChange, options }: SelectFieldProps) {
  return (
    <label className="grid gap-2 text-xs uppercase text-slate-500">
      {label}
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="rounded-xl border border-slate-800 bg-slate-900/50 px-4 py-3 text-sm text-slate-100 focus:border-accent"
      >
        {options.map((token) => (
          <option key={token.mint} value={token.mint}>
            {token.symbol}
          </option>
        ))}
      </select>
    </label>
  );
}
