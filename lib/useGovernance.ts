"use client";

import { useQuery } from "@tanstack/react-query";

export type ProposalPreview = {
  proposalId: string;
  realm: string;
  title: string;
  status: "Pending" | "Succeeded" | "Defeated";
  votingStart: string;
  votingEnd: string;
  yesVotes: string;
  noVotes: string;
  quorum: string;
};

export type GovernanceResponse = {
  proposals: ProposalPreview[];
};

export function useGovernance() {
  return useQuery<GovernanceResponse>({
    queryKey: ["governance"],
    queryFn: async () => {
      const res = await fetch("/api/governance", { cache: "no-store" });
      if (!res.ok) {
        throw new Error(`Failed to fetch proposals: ${res.status}`);
      }
      return res.json();
    }
  });
}
