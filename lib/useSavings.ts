"use client";

import { useQuery } from "@tanstack/react-query";

export type SavingsVault = {
  vaultId: string;
  term: string;
  apy: string;
  depositMint: string;
  rewardMint: string;
  tvl: string;
  unlockDate: string;
};

export type SavingsResponse = {
  vaults: SavingsVault[];
};

export function useSavingsVaults() {
  return useQuery<SavingsResponse>({
    queryKey: ["savings"],
    queryFn: async () => {
      const res = await fetch("/api/savings", { cache: "no-store" });
      if (!res.ok) {
        throw new Error(`Failed to fetch savings vaults: ${res.status}`);
      }
      return res.json();
    }
  });
}
