"use client";

import { useQuery } from "@tanstack/react-query";

export type DaoSponsor = {
  daoId: string;
  name: string;
  passMint: string;
  sponsorVault: string;
  maxRelaySpend: string;
  relaySpent: string;
  members: number;
};

export type DaoResponse = {
  daos: DaoSponsor[];
};

export function useDaoOverview() {
  return useQuery<DaoResponse>({
    queryKey: ["dao-overview"],
    queryFn: async () => {
      const res = await fetch("/api/dao", { cache: "no-store" });
      if (!res.ok) {
        throw new Error(`Failed to fetch DAO overview: ${res.status}`);
      }
      return res.json();
    }
  });
}
