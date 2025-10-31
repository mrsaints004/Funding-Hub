import { useQuery } from "@tanstack/react-query";
import { useWallet } from "@solana/wallet-adapter-react";
import { PortfolioSummary } from "./portfolioAnalytics";

export function usePortfolio() {
  const { publicKey } = useWallet();

  return useQuery<PortfolioSummary>({
    queryKey: ["portfolio", publicKey?.toString()],
    queryFn: async () => {
      if (!publicKey) {
        throw new Error("Wallet not connected");
      }

      const response = await fetch(`/api/portfolio?wallet=${publicKey.toString()}`);

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.error || "Failed to fetch portfolio");
      }

      return response.json();
    },
    enabled: !!publicKey,
    refetchInterval: 30000, // Refetch every 30 seconds
    staleTime: 15000, // Consider data stale after 15 seconds
  });
}
