"use client";

import Link from "next/link";
import { useDaoOverview } from "../../lib/useDao";
import { WalletButton } from "../../components/WalletButton";

export default function DaoPage() {
  const { data, isLoading, error } = useDaoOverview();

  return (
    <div className="flex flex-col gap-8">
      <header className="rounded-2xl border border-slate-800/70 bg-slate-900/40 px-6 py-8 backdrop-blur">
        <div className="flex items-center justify-between">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-primary/40 bg-primary/10 px-4 py-1 text-[11px] uppercase tracking-[0.25em] text-primary">
              DAO Hub
            </div>
            <h2 className="mt-4 text-3xl font-semibold text-slate-50">Decentralized Organizations</h2>
            <p className="mt-2 text-sm text-slate-400">
              Configure membership NFTs, sponsor treasuries, and governance settings.
            </p>
          </div>
          <WalletButton />
        </div>

        <div className="mt-6 flex gap-4">
          <Link
            href="/dao/create-proposal"
            className="inline-flex items-center justify-center rounded-full bg-gradient-to-r from-accent via-primary to-accent px-6 py-3 text-sm font-semibold text-slate-950 shadow-lg transition hover:shadow-[0_20px_45px_-25px_rgba(20,241,149,0.55)]"
          >
            Create Proposal
          </Link>
          <Link
            href="/dao/deposit"
            className="inline-flex items-center justify-center rounded-full border border-slate-700/70 bg-slate-900/50 px-6 py-3 text-sm text-slate-200 transition hover:border-accent/60"
          >
            Sponsor Vault
          </Link>
        </div>
      </header>

      <section className="grid gap-4 md:grid-cols-2">
        <article className="rounded-2xl border border-slate-800 bg-slate-900/40 p-6">
          <h3 className="text-lg font-semibold text-slate-100">Set Up Membership</h3>
          <ul className="mt-3 space-y-2 text-sm text-slate-300">
            <li>• Mint DAO pass NFT collection via `dao_pass::initialize_dao`.</li>
            <li>• Assign proposal &amp; voting configs, distribution vaults.</li>
            <li>• Publish metadata to IPFS/Arweave for fully serverless storage.</li>
          </ul>
        </article>
        <article className="rounded-2xl border border-slate-800 bg-slate-900/40 p-6">
          <h3 className="text-lg font-semibold text-slate-100">Gas Sponsor Relay</h3>
          <p className="mt-3 text-sm text-slate-300">
            Each DAO maintains a sponsor vault. Cloudflare Worker relayers monitor
            queued swap transactions and re-sign them, using DAO treasury for compute
            while honoring rate limits &amp; intent filters defined on-chain.
          </p>
        </article>
      </section>

      {error && (
        <div className="rounded-2xl border border-red-800/50 bg-red-950/20 p-6 text-sm text-red-400">
          <h3 className="font-semibold">Error Loading DAOs</h3>
          <p className="mt-2">{(error as Error).message}</p>
          <p className="mt-3 text-xs text-red-300">
            Note: DAOs will display fallback data if the indexer is unavailable.
          </p>
        </div>
      )}

      <section className="rounded-2xl border border-slate-800 bg-slate-900/40 p-6">
        <header className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-slate-100">DAO Sponsor Overview</h3>
            <p className="text-xs text-slate-400">
              Data mirrored from the `dao_pass` program via serverless indexer.
            </p>
          </div>
          <span className="text-xs text-slate-500">
            {isLoading ? "Syncing…" : `${data?.daos.length ?? 0} DAOs`}
          </span>
        </header>

        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full text-left text-sm text-slate-300">
            <thead>
              <tr className="text-xs uppercase tracking-wide text-slate-500">
                <th className="pb-2 pr-4">DAO</th>
                <th className="pb-2 pr-4">Pass Mint</th>
                <th className="pb-2 pr-4">Max Sponsor</th>
                <th className="pb-2 pr-4">Spent</th>
                <th className="pb-2 pr-4">Members</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {isLoading && (
                <tr>
                  <td colSpan={5} className="py-4 text-center text-slate-500">
                    Loading DAO metrics…
                  </td>
                </tr>
              )}
              {!isLoading && data?.daos.map((dao) => (
                <tr key={dao.daoId} className="hover:bg-slate-900/40">
                  <td className="py-3 pr-4 font-medium text-slate-100">{dao.name}</td>
                  <td className="py-3 pr-4 text-xs text-slate-400">{dao.passMint}</td>
                  <td className="py-3 pr-4 text-slate-200">{dao.maxRelaySpend}</td>
                  <td className="py-3 pr-4 text-slate-200">{dao.relaySpent}</td>
                  <td className="py-3 pr-4 text-slate-200">{dao.members}</td>
                </tr>
              ))}
              {!isLoading && !data?.daos.length && (
                <tr>
                  <td colSpan={5} className="py-4 text-center text-slate-500">
                    No DAOs indexed yet. Initialize one via Anchor CLI.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
