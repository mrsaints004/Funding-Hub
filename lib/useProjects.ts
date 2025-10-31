"use client";

import { useQuery } from "@tanstack/react-query";

export type ProjectMetric = {
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

export type PlatformMetrics = {
  activeProjects: string;
  tvl: string;
  daoMembers: string;
  savingsDeposits: string;
};

export type ProjectsResponse = {
  projects: ProjectMetric[];
  metrics: PlatformMetrics;
};

export function useProjects() {
  return useQuery<ProjectsResponse>({
    queryKey: ["projects"],
    queryFn: async () => {
      const res = await fetch("/api/projects", { cache: "no-store" });
      if (!res.ok) {
        throw new Error(`Failed to fetch projects: ${res.status}`);
      }
      return res.json();
    }
  });
}
