"use client";

import { Buffer } from "buffer";
import { useState } from "react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";

import { buildDaoSponsorDepositTx } from "../../../lib/transactions";

export default function DaoDepositPage() {
  const wallet = useWallet();
  const { connection } = useConnection();
  const [sponsorVault, setSponsorVault] = useState("");
  const [amount, setAmount] = useState("0.1");
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!wallet.connected) {
      setError("Connect your wallet to craft the deposit transaction.");
      return;
    }
    setError(null);
    setResult(null);
    setLoading(true);
    try {
      const tx = await buildDaoSponsorDepositTx({
        connection,
        wallet,
        sponsorVault,
        amount: Number(amount) * 1_000_000_000 // convert SOL to lamports
      });
      const serialized = Buffer.from(tx.serialize({ requireAllSignatures: false })).toString("base64");
      setResult(serialized);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-10">
      <header className="rounded-2xl border border-slate-800/70 bg-slate-900/40 px-6 py-8 backdrop-blur">
        <div className="inline-flex items-center gap-2 rounded-full border border-accent/40 bg-accent/10 px-4 py-1 text-[11px] uppercase tracking-[0.25em] text-accent">
          DAO Treasury
        </div>
        <h2 className="mt-4 text-3xl font-semibold text-slate-50">Sponsor Vault Deposit</h2>
        <p className="mt-2 text-sm text-slate-400">
          Top up the DAO fee sponsorship vault so relayers can cover gas on behalf of members. The transaction transfers
          SOL directly from your wallet into the configured sponsor treasury account.
        </p>
      </header>

      <form
        onSubmit={handleSubmit}
        className="space-y-5 rounded-2xl border border-slate-800/70 bg-slate-950/50 px-6 py-8 shadow-[0_30px_60px_-45px_rgba(153,69,255,0.45)] backdrop-blur"
      >
        <label className="grid gap-2 text-xs uppercase text-slate-500">
          Sponsor Vault Address
          <input
            value={sponsorVault}
            onChange={(event) => setSponsorVault(event.target.value)}
            placeholder="DAO sponsor vault pubkey"
            required
            className="rounded-xl border border-slate-800 bg-slate-900/50 px-4 py-3 text-sm text-slate-100 focus:border-accent"
          />
        </label>
        <label className="grid gap-2 text-xs uppercase text-slate-500">
          Amount (SOL)
          <input
            type="number"
            min="0"
            step="0.001"
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            className="rounded-xl border border-slate-800 bg-slate-900/50 px-4 py-3 text-sm text-slate-100 focus:border-accent"
            required
          />
        </label>
        <button
          type="submit"
          disabled={loading}
          className="inline-flex items-center justify-center rounded-full bg-gradient-to-r from-primary via-accent to-primary px-6 py-3 text-sm font-semibold text-slate-950 shadow-lg transition hover:shadow-[0_20px_45px_-25px_rgba(153,69,255,0.55)] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? "Preparing…" : "Generate Deposit Tx"}
        </button>
        {error && <p className="text-sm text-red-400">{error}</p>}
      </form>

      {result && (
        <section className="rounded-2xl border border-slate-800/70 bg-slate-950/60 px-6 py-6 text-sm text-slate-300 backdrop-blur">
          <h3 className="text-lg font-semibold text-slate-100">Unsigned transaction</h3>
          <p className="mt-2 text-xs text-slate-500">
            Sign with your wallet, then submit directly or via the relayer for sponsorship.
          </p>
          <div className="mt-4 overflow-x-auto rounded border border-slate-800/70 bg-slate-900/50 p-4 font-mono text-xs">
            <pre>{result}</pre>
          </div>
        </section>
      )}
    </div>
  );
}
