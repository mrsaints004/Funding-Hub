"use client";

import { Buffer } from "buffer";
import { memo, useState } from "react";
import type { Connection } from "@solana/web3.js";
import { useConnection, useWallet, type WalletContextState } from "@solana/wallet-adapter-react";

import { buildPledgeTx } from "../lib/transactions";

type Project = {
  projectId: string;
  slug: string;
  title: string;
  summary?: string;
  description: string;
  targetAmount: string;
  raised: string;
  deadline: string;
  dao?: string;
  projectAddress?: string;
  mint?: string;
  badgeMint?: string;
  vault?: string;
  status?: string;
  proposer?: string;
};

type ProjectsGridProps = {
  projects: Project[];
  loading?: boolean;
};

type PledgeDraft = {
  serialized: string;
  encoding: "base64";
  project: string;
  donorTokenAccount: string;
  donorBadgeAccount: string;
};

export const ProjectsGrid = memo(function ProjectsGrid({
  projects,
  loading
}: ProjectsGridProps) {
  const { connection } = useConnection();
  const wallet = useWallet();

  if (loading) {
    return (
      <div className="grid gap-4 md:grid-cols-3">
        {Array.from({ length: 3 }).map((_, idx) => (
          <div
            key={idx}
            className="h-40 animate-pulse rounded-2xl border border-slate-800 bg-slate-900/20"
          />
        ))}
      </div>
    );
  }

  if (!projects.length) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-800 bg-slate-900/20 p-8 text-center text-sm text-slate-400">
        No projects yet. Be the first to launch a funding vault.
      </div>
    );
  }

  return (
    <div className="grid gap-6 md:grid-cols-3">
      {projects.map((project) => (
        <ProjectCard
          key={project.projectId}
          project={project}
          connection={connection}
          wallet={wallet}
        />
      ))}
    </div>
  );
});

type ProjectCardProps = {
  project: Project;
  connection: Connection;
  wallet: WalletContextState;
};

function ProjectCard({ project, connection, wallet }: ProjectCardProps) {
  const [isFormOpen, setFormOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [draft, setDraft] = useState<PledgeDraft | null>(null);
  const [relayState, setRelayState] = useState<"idle" | "sending" | "success" | "error">("idle");
  const [relayResponse, setRelayResponse] = useState<any>(null);

  const handleToggle = () => {
    if (!wallet.connected) {
      alert("Connect your wallet to pledge.");
      return;
    }
    if (!project.projectAddress) {
      alert("Indexer data missing project address. Try again once the indexer is synced.");
      return;
    }
    setFormOpen((prev) => !prev);
    setError(null);
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setRelayState("idle");
    setRelayResponse(null);

    if (!amount || Number(amount) <= 0) {
      setError("Enter a positive amount in lamports.");
      return;
    }

    try {
      setLoading(true);
      const payload = await buildPledgeTx({
        connection,
        wallet,
        project: project.projectAddress!,
        amount
      });

      const serialized = Buffer.from(
        payload.transaction.serialize({ requireAllSignatures: false })
      ).toString("base64");

      setDraft({
        serialized,
        encoding: "base64",
        project: payload.project.toBase58(),
        donorTokenAccount: payload.donorTokenAccount.toBase58(),
        donorBadgeAccount: payload.donorBadgeAccount.toBase58()
      });
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const handleRelay = async () => {
    if (!draft) return;

    try {
      setRelayState("sending");
      const res = await fetch("/api/relayer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          dao: project.dao ?? project.projectId,
          serializedTransaction: draft.serialized,
          encoding: draft.encoding
        })
      });
      const json = await res.json().catch(() => ({}));
      setRelayResponse(json);
      setRelayState(res.ok ? "success" : "error");
      if (!res.ok) {
        setError(json?.error ?? `Relayer error (${res.status})`);
      }
    } catch (err) {
      setRelayState("error");
      setError((err as Error).message);
    }
  };

  return (
    <article className="group relative flex flex-col gap-4 overflow-hidden rounded-2xl border border-slate-800/70 bg-slate-900/50 p-6 transition-all duration-300 hover:-translate-y-1 hover:border-accent/70 hover:shadow-[0_20px_45px_-25px_rgba(20,241,149,0.55)]">
      <div className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100" style={{
        background:
          "radial-gradient(100% 120% at 10% 0%, rgba(153,69,255,0.25) 0%, transparent 55%), radial-gradient(90% 120% at 90% 10%, rgba(20,241,149,0.25) 0%, transparent 50%)"
      }} />
        <div className="relative z-10 flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div>
          <h4 className="text-lg font-semibold text-slate-100 md:text-xl">{project.title}</h4>
          <p className="mt-2 text-sm text-slate-400 md:text-[15px]">{project.summary ?? project.description}</p>
          </div>
          <span className="rounded-full border border-accent/40 bg-accent/10 px-3 py-1 text-[11px] uppercase tracking-[0.2em] text-accent">
            {project.status ?? "Active"}
          </span>
        </div>
      <dl className="grid grid-cols-2 gap-3 text-sm text-slate-300">
        <div>
          <dt className="text-slate-500">Target</dt>
          <dd className="font-medium text-slate-100">{project.targetAmount}</dd>
        </div>
        <div>
          <dt className="text-slate-500">Raised</dt>
          <dd className="font-medium text-primary">{project.raised}</dd>
        </div>
        <div>
          <dt className="text-slate-500">Deadline</dt>
          <dd>{project.deadline}</dd>
        </div>
        <div>
          <dt className="text-slate-500">DAO</dt>
          <dd>{project.dao ?? "Independent"}</dd>
        </div>
        {project.proposer && (
          <div>
            <dt className="text-slate-500">Submitted By</dt>
            <dd>{project.proposer}</dd>
          </div>
        )}
      </dl>

      <button
        onClick={handleToggle}
        className="relative z-10 inline-flex items-center justify-center rounded-full bg-gradient-to-r from-accent/80 to-primary/80 px-4 py-2 text-sm font-semibold text-slate-950 shadow-sm transition-all duration-200 hover:from-accent hover:to-primary disabled:cursor-not-allowed disabled:opacity-40"
        disabled={!project.projectAddress}
      >
        {isFormOpen ? "Close" : "Pledge"}
      </button>

      {isFormOpen && (
        <form onSubmit={handleSubmit} className="relative z-10 space-y-3 rounded-xl border border-slate-800/80 bg-slate-950/60 p-4 text-sm text-slate-300 backdrop-blur">
          <label className="flex flex-col gap-2 text-xs uppercase text-slate-500">
            Amount (lamports)
            <input
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              type="number"
              min="1"
              className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 focus:border-primary"
              placeholder="1000000"
            />
          </label>
          <div className="flex flex-wrap gap-3">
            <button
              type="submit"
              disabled={loading}
              className="rounded-full bg-primary px-4 py-2 text-xs font-semibold text-slate-950 transition hover:bg-primary-dark disabled:cursor-not-allowed disabled:bg-slate-700"
            >
              {loading ? "Preparing…" : "Generate Draft"}
            </button>
            {draft && (
              <button
                type="button"
                onClick={handleRelay}
                className="rounded-full border border-accent px-4 py-2 text-xs font-semibold text-accent transition hover:bg-accent/20 disabled:cursor-not-allowed"
                disabled={relayState === "sending"}
              >
                {relayState === "sending" ? "Sending…" : "Send to Relayer"}
              </button>
            )}
          </div>
          {error && <p className="mt-3 text-xs text-red-400">{error}</p>}
        </form>
      )}

      {draft && (
        <div className="relative z-10 space-y-2 rounded-xl border border-slate-800/80 bg-slate-950/70 p-4 text-xs text-slate-300 backdrop-blur">
          <p className="font-semibold text-slate-200">Unsigned transaction</p>
          <div className="overflow-x-auto rounded border border-slate-800 bg-slate-900/60 p-3 font-mono">
            <pre>{JSON.stringify(draft, null, 2)}</pre>
          </div>
          {relayState !== "idle" && (
            <div className="rounded border border-slate-800/60 bg-slate-900/40 p-3">
              <p className="font-semibold text-slate-200">Relayer response</p>
              <pre className="mt-2 overflow-x-auto font-mono text-[11px] text-slate-400">
                {JSON.stringify(relayResponse ?? {}, null, 2)}
              </pre>
            </div>
          )}
        </div>
      )}
    </article>
  );
}
