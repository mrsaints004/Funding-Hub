"use client";

import { useState } from "react";
import { ProjectsGrid } from "../../components/ProjectsGrid";
import { ProposalList } from "../../components/ProposalList";
import { Portfolio } from "../../components/Portfolio";
import { useProjects } from "../../lib/useProjects";

type DashboardTab = "overview" | "portfolio" | "governance";

export default function DashboardPage() {
  const { data, isLoading } = useProjects();
  const [activeTab, setActiveTab] = useState<DashboardTab>("overview");

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-4">
        <div>
          <h2 className="text-2xl font-semibold text-slate-100">Dashboard</h2>
          <p className="mt-1 text-sm text-slate-400">
            Track your portfolio, funding projects, and governance activity
          </p>
        </div>

        {/* Tab Navigation */}
        <div className="flex gap-2 border-b border-slate-800">
          <button
            onClick={() => setActiveTab("overview")}
            className={`px-4 py-2 text-sm font-medium transition ${
              activeTab === "overview"
                ? "border-b-2 border-primary text-primary"
                : "text-slate-400 hover:text-slate-300"
            }`}
          >
            Overview
          </button>
          <button
            onClick={() => setActiveTab("portfolio")}
            className={`px-4 py-2 text-sm font-medium transition ${
              activeTab === "portfolio"
                ? "border-b-2 border-primary text-primary"
                : "text-slate-400 hover:text-slate-300"
            }`}
          >
            Portfolio Analytics
          </button>
          <button
            onClick={() => setActiveTab("governance")}
            className={`px-4 py-2 text-sm font-medium transition ${
              activeTab === "governance"
                ? "border-b-2 border-primary text-primary"
                : "text-slate-400 hover:text-slate-300"
            }`}
          >
            Governance
          </button>
        </div>
      </header>

      {/* Tab Content */}
      {activeTab === "overview" && (
        <div className="flex flex-col gap-8">
          <div>
            <h3 className="mb-4 text-xl font-semibold text-slate-100">Active Projects</h3>
            <ProjectsGrid projects={data?.projects ?? []} loading={isLoading} />
          </div>
        </div>
      )}

      {activeTab === "portfolio" && (
        <div>
          <Portfolio />
        </div>
      )}

      {activeTab === "governance" && (
        <div>
          <ProposalList />
        </div>
      )}
    </div>
  );
}
