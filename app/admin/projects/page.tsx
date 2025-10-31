"use client";

import { useEffect, useState } from "react";

type AdminProject = {
  id: string;
  title: string;
  summary: string;
  description: string;
  fundingGoal: number;
  fundingMint: string;
  metadataUri?: string;
  proposer: string;
  createdAt: string;
  status: string;
};

type ProjectsResponse = {
  pending: AdminProject[];
  approved: AdminProject[];
};

export default function AdminProjectsPage() {
  const [data, setData] = useState<ProjectsResponse>({ pending: [], approved: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [processing, setProcessing] = useState<string | null>(null);

  const fetchProjects = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/projects", { cache: "no-store" });
      if (!res.ok) {
        throw new Error(`Failed to load (${res.status})`);
      }
      const json = (await res.json()) as ProjectsResponse;
      setData(json);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProjects();
  }, []);

  const handleAction = async (id: string, action: "approved" | "rejected") => {
    setProcessing(id);
    setError(null);
    try {
      const res = await fetch("/api/admin/projects", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, action })
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `Action failed (${res.status})`);
      }
      const json = (await res.json()) as ProjectsResponse;
      setData(json);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setProcessing(null);
    }
  };

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-10">
      <header className="rounded-2xl border border-slate-800/70 bg-slate-900/40 px-6 py-8 backdrop-blur">
        <div className="inline-flex items-center gap-2 rounded-full border border-primary/40 bg-primary/10 px-4 py-1 text-[11px] uppercase tracking-[0.25em] text-primary">
          Admin Panel
        </div>
        <h2 className="mt-4 text-3xl font-semibold text-slate-50">Project Approvals</h2>
        <p className="mt-2 text-sm text-slate-400">
          Review newly submitted funding campaigns. Approve to publish them to the public dashboard or reject with
          feedback to the proposer.
        </p>
      </header>

      {error && <p className="text-sm text-red-400">{error}</p>}

      <section className="space-y-4">
        <h3 className="text-xl font-semibold text-slate-100">Pending Review</h3>
        {loading ? (
          <div className="grid gap-4 md:grid-cols-2">
            {Array.from({ length: 2 }).map((_, index) => (
              <div key={index} className="h-40 animate-pulse rounded-2xl border border-slate-800/60 bg-slate-900/30" />
            ))}
          </div>
        ) : data.pending.length === 0 ? (
          <p className="text-sm text-slate-400">No submissions awaiting review.</p>
        ) : (
          <div className="grid gap-6 md:grid-cols-2">
            {data.pending.map((project) => (
              <article
                key={project.id}
                className="group relative flex flex-col gap-3 rounded-2xl border border-slate-800/70 bg-slate-950/60 p-6 backdrop-blur transition hover:border-primary/60"
              >
                <div>
                  <h4 className="text-lg font-semibold text-slate-100">{project.title}</h4>
                  <p className="mt-2 text-sm text-slate-400">{project.summary}</p>
                </div>
                <dl className="grid grid-cols-2 gap-3 text-xs text-slate-400">
                  <div>
                    <dt>Funding Goal</dt>
                    <dd className="text-sm text-slate-200">{formatLamports(project.fundingGoal)}</dd>
                  </div>
                  <div>
                    <dt>Mint</dt>
                    <dd className="text-sm text-slate-200">{project.fundingMint}</dd>
                  </div>
                  <div>
                    <dt>Submitted</dt>
                    <dd>{new Date(project.createdAt).toLocaleString()}</dd>
                  </div>
                  <div>
                    <dt>Contact</dt>
                    <dd>{project.proposer}</dd>
                  </div>
                </dl>
                <p className="text-xs text-slate-500">{project.description}</p>
                {project.metadataUri && (
                  <a
                    href={project.metadataUri}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs text-primary hover:underline"
                  >
                    View supporting metadata
                  </a>
                )}
                <div className="mt-4 flex gap-3">
                  <button
                    className="inline-flex flex-1 items-center justify-center rounded-full bg-gradient-to-r from-accent via-primary to-accent px-4 py-2 text-xs font-semibold text-slate-950 shadow hover:shadow-[0_15px_35px_-20px_rgba(20,241,149,0.6)] disabled:cursor-not-allowed disabled:opacity-60"
                    disabled={processing === project.id}
                    onClick={() => handleAction(project.id, "approved")}
                  >
                    {processing === project.id ? "Processing…" : "Approve"}
                  </button>
                  <button
                    className="inline-flex flex-1 items-center justify-center rounded-full border border-red-400/60 px-4 py-2 text-xs font-semibold text-red-300 transition hover:bg-red-400/10 disabled:cursor-not-allowed disabled:opacity-60"
                    disabled={processing === project.id}
                    onClick={() => handleAction(project.id, "rejected")}
                  >
                    Reject
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="space-y-4">
        <h3 className="text-xl font-semibold text-slate-100">Approved Projects</h3>
        {data.approved.length === 0 ? (
          <p className="text-sm text-slate-400">No approved projects yet.</p>
        ) : (
          <div className="grid gap-4">
            {data.approved.map((project) => (
              <article
                key={project.id}
                className="rounded-2xl border border-slate-800/70 bg-slate-950/50 p-5 text-sm text-slate-300 backdrop-blur"
              >
                <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                  <div>
                    <h4 className="text-lg font-semibold text-slate-100">{project.title}</h4>
                    <p className="text-xs text-slate-500">
                      Approved on {new Date(project.createdAt).toLocaleString()} — Goal {formatLamports(project.fundingGoal)}
                    </p>
                  </div>
                  <span className="rounded-full border border-primary/40 bg-primary/10 px-3 py-1 text-[11px] uppercase tracking-[0.25em] text-primary">
                    Approved
                  </span>
                </div>
                <p className="mt-2 text-sm text-slate-400">{project.summary}</p>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function formatLamports(value: number) {
  if (!Number.isFinite(value)) return "—";
  const sol = value / 1_000_000_000;
  return `${sol.toLocaleString(undefined, { maximumFractionDigits: 2 })} SOL`;
}
