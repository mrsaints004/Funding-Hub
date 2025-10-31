"use client";

import { useGovernance } from "../lib/useGovernance";

export function ProposalList() {
  const { data, isLoading } = useGovernance();

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-6">
      <header className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-slate-100">Active Proposals</h3>
        <span className="text-xs text-slate-500">
          {isLoading ? "Loading…" : `${data?.proposals.length ?? 0} proposals`}
        </span>
      </header>
      <div className="mt-4 space-y-3 text-sm text-slate-300">
        {isLoading && (
          <p className="text-slate-500">Fetching governance data…</p>
        )}
        {!isLoading && data?.proposals.map((proposal) => (
          <article
            key={proposal.proposalId}
            className="rounded-xl border border-slate-800/60 bg-slate-900/40 p-4"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs uppercase tracking-wide text-slate-400">
                {proposal.realm}
              </span>
              <span
                className={`text-xs font-semibold ${statusColor(proposal.status)}`}
              >
                {proposal.status}
              </span>
            </div>
            <h4 className="mt-2 text-base font-semibold text-slate-100">
              {proposal.title}
            </h4>
            <dl className="mt-3 grid grid-cols-3 gap-2 text-xs text-slate-400">
              <div>
                <dt>Yes</dt>
                <dd className="text-slate-200">{proposal.yesVotes}</dd>
              </div>
              <div>
                <dt>No</dt>
                <dd className="text-slate-200">{proposal.noVotes}</dd>
              </div>
              <div>
                <dt>Quorum</dt>
                <dd className="text-slate-200">{proposal.quorum}</dd>
              </div>
            </dl>
            <p className="mt-2 text-xs text-slate-500">
              {proposal.votingStart} → {proposal.votingEnd}
            </p>
          </article>
        ))}
        {!isLoading && !data?.proposals.length && (
          <p className="text-slate-500">No proposals yet. Launch one via `governance::create_proposal`.</p>
        )}
      </div>
    </div>
  );
}

function statusColor(status: string): string {
  switch (status) {
    case "Succeeded":
      return "text-primary";
    case "Defeated":
      return "text-red-400";
    default:
      return "text-slate-400";
  }
}
