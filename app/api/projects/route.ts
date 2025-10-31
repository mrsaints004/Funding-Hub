import { NextResponse } from "next/server";
import { fetchIndexer } from "../../../lib/indexer";
import { listApprovedProjects } from "../../../lib/storage";

const FALLBACK = {
  projects: [
    {
      projectId: "alpha",
      slug: "alpha",
      title: "Alpha Labs: zkCredential Network",
      description:
        "Building privacy preserving reputation for DAOs with on-chain attestations and donation badges.",
      targetAmount: "50,000 USDC",
      raised: "12,450 USDC",
      deadline: "Mar 12, 2025",
      dao: "AlphaDAO",
      status: "Active"
    },
    {
      projectId: "green-galaxy",
      slug: "green-galaxy",
      title: "Green Galaxy Reforestation",
      description:
        "Climate-positive DeFi vault raising community funds to tokenize carbon credits on Solana.",
      targetAmount: "120,000 USDC",
      raised: "94,220 USDC",
      deadline: "Apr 3, 2025",
      dao: "Planetary Guild",
      status: "Active"
    },
    {
      projectId: "sol-scholars",
      slug: "sol-scholars",
      title: "Sol Scholars Program",
      description:
        "Grants for bootcamp graduates committed to building public goods in the Solana ecosystem.",
      targetAmount: "35,000 USDC",
      raised: "27,880 USDC",
      deadline: "Feb 20, 2025",
      dao: "Builders Collective",
      status: "Active"
    }
  ],
  metrics: {
    activeProjects: "18",
    tvl: "$1.42M",
    daoMembers: "4,230",
    savingsDeposits: "$620k"
  }
};

export async function GET() {
  const data = await fetchIndexer({ path: "/projects", fallback: FALLBACK });
  const approved = await listApprovedProjects();
  const approvedProjects = approved.map(mapApprovedProject);
  const projects = [...approvedProjects, ...(data.projects ?? []).map(normalizeProject)];
  const metrics = normalizeMetrics(data.metrics, FALLBACK.metrics);
  return NextResponse.json({ projects, metrics });
}

function mapApprovedProject(project: any) {
  const target = Number(project.fundingGoal) || 0;
  return {
    projectId: project.id,
    slug: project.id,
    title: project.title,
    description: project.summary,
    targetAmount: formatLamports(target),
    raised: "0 SOL",
    deadline: new Date(project.createdAt).toUTCString(),
    dao: project.proposer,
    projectAddress: project.onChainProject ?? undefined,
    mint: project.fundingMint,
    badgeMint: project.badgeMint,
    vault: project.vault,
    status: project.status ?? "Approved",
    proposer: project.proposer
  };
}

function normalizeProject(project: any) {
  if (project && project.authority && project.mint) {
    const deadline = project.deadlineTs
      ? new Date(Number(project.deadlineTs) * 1000).toUTCString()
      : "—";
    return {
      projectId: project.projectId?.toString() ?? project.project ?? "unknown",
      slug: project.project ? project.project.toString() : `project-${project.projectId}`,
      title: project.projectId ? `Project #${project.projectId}` : "Funding Project",
      description: `Authority ${shorten(project.authority)} | Status ${project.status ?? "Active"}`,
      targetAmount: formatLamports(project.targetAmount),
      raised: formatLamports(project.pledged),
      deadline,
      dao: project.authority,
      projectAddress: project.project ?? project.pubkey ?? undefined,
      mint: project.mint,
      badgeMint: project.badgeMint,
      vault: project.vault,
      status: project.status ?? "Active"
    };
  }
  return project;
}

function normalizeMetrics(metrics: any, fallback: any) {
  if (!metrics || metrics.totalPledged === undefined) return fallback;
  return {
    activeProjects: metrics.totalProjects?.toString() ?? fallback.activeProjects,
    tvl: formatLamports(metrics.totalPledged) ?? fallback.tvl,
    daoMembers: fallback.daoMembers,
    savingsDeposits: fallback.savingsDeposits
  };
}

function formatLamports(value: any) {
  if (!value && value !== 0) return "—";
  const lamports = BigInt(value.toString());
  const sol = Number(lamports) / 1_000_000_000;
  return `${sol.toFixed(2)} SOL`;
}

function shorten(address: string) {
  return `${address.slice(0, 4)}…${address.slice(-4)}`;
}
