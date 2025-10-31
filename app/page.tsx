"use client";

import Link from "next/link";
import { useMemo } from "react";
import { useProjects } from "../lib/useProjects";
import { ProjectsGrid } from "../components/ProjectsGrid";

export default function HomePage() {
  const { data, isLoading } = useProjects();

  const featured = useMemo(() => data?.projects.slice(0, 3) ?? [], [data]);

  return (
    <div className="flex flex-col gap-14">
      <section className="grid gap-8 md:grid-cols-[1.6fr,1fr]">
        <div className="relative overflow-hidden rounded-3xl border border-slate-800/70 bg-gradient-to-br from-slate-900/70 via-slate-900/40 to-slate-900/10 p-8 shadow-[0_35px_65px_-45px_rgba(20,241,149,0.4)] backdrop-blur">
          <div className="absolute -top-24 right-10 h-48 w-48 rounded-full bg-primary/20 blur-3xl" />
          <h2 className="relative z-10 text-4xl font-semibold text-slate-50 md:text-5xl">
            Launch and fund bold ideas together.
          </h2>
          <p className="relative z-10 mt-5 max-w-2xl text-[15px] text-slate-300">
            Spin up programmable funding vaults, issue donation badges, and rally your DAO with gas-sponsored
            swaps. Every interaction is anchored on Solana, with serverless relayers and indexers handling the
            heavy lift in the background.
          </p>
          <div className="relative z-10 mt-8 flex flex-wrap gap-4 text-sm">
            <Link
              href="/projects/submit"
              className="inline-flex items-center justify-center rounded-full bg-gradient-to-r from-accent via-primary to-accent px-6 py-3 font-semibold text-slate-950 shadow-lg transition-all duration-300 hover:shadow-[0_25px_55px_-30px_rgba(20,241,149,0.6)]"
            >
              Launch Campaign
            </Link>
            <Link
              href="/dashboard"
              className="inline-flex items-center justify-center rounded-full border border-slate-700/70 bg-slate-900/50 px-6 py-3 text-slate-200 transition duration-200 hover:border-accent/60 hover:text-slate-50"
            >
              View Dashboard
            </Link>
          </div>
        </div>

        <div className="rounded-3xl border border-slate-800/70 bg-slate-900/40 p-6 backdrop-blur">
          <h3 className="text-lg font-medium text-slate-100">Platform Snapshot</h3>
          <dl className="mt-6 grid grid-cols-2 gap-4 text-sm text-slate-300">
            {[
              {
                label: "Active Funding Pools",
                value: data?.metrics.activeProjects ?? "—",
                accent: "text-slate-100"
              },
              {
                label: "TVL",
                value: data?.metrics.tvl ?? "—",
                accent: "text-primary"
              },
              {
                label: "DAO Members",
                value: data?.metrics.daoMembers ?? "—",
                accent: "text-slate-100"
              },
              {
                label: "Savings Deposits",
                value: data?.metrics.savingsDeposits ?? "—",
                accent: "text-accent"
              }
            ].map((item) => (
              <div
                key={item.label}
                className="rounded-2xl border border-slate-800/60 bg-slate-900/40 px-4 py-3 transition duration-200 hover:border-accent/50"
              >
                <dt className="text-[11px] uppercase tracking-[0.25em] text-slate-500">
                  {item.label}
                </dt>
                <dd className={`mt-2 text-xl font-semibold ${item.accent}`}>{item.value}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      <section className="flex flex-col gap-5">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <h3 className="text-2xl font-semibold text-slate-100">Featured Projects</h3>
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-2 text-sm text-primary transition hover:text-primary-dark"
          >
            View all
            <span aria-hidden="true">→</span>
          </Link>
        </div>
        <ProjectsGrid projects={featured} loading={isLoading} />
      </section>

      <section className="grid gap-6 md:grid-cols-3">
        <FeatureCard
          title="Gas Sponsored Swaps"
          description="DAO-backed relayers cover compute fees for members via sponsor treasuries and policy-managed budgets."
        />
        <FeatureCard
          title="Savings Vaults"
          description="Lock assets for 3, 6, or 12 months and earn programmable APYs streamed from DAO reward pools."
        />
        <FeatureCard
          title="Portfolio Analytics"
          description="Edge workers index wallet balances, donation badges, and commitments for real-time visibility."
        />
      </section>
    </div>
  );
}

function FeatureCard({ title, description }: { title: string; description: string }) {
  return (
    <article className="group relative overflow-hidden rounded-3xl border border-slate-800/70 bg-slate-900/40 p-6 transition-all duration-300 hover:-translate-y-1 hover:border-accent/60 hover:shadow-[0_25px_50px_-30px_rgba(153,69,255,0.45)]">
      <div className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100" style={{
        background:
          "linear-gradient(135deg, rgba(153,69,255,0.25), transparent 60%), radial-gradient(120% 80% at 100% 0%, rgba(20,241,149,0.22) 0%, transparent 60%)"
      }} />
      <div className="relative z-10">
        <h4 className="text-lg font-semibold text-slate-100 md:text-xl">{title}</h4>
        <p className="mt-3 text-sm text-slate-300 md:text-[15px]">{description}</p>
      </div>
    </article>
  );
}
