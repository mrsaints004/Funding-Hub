"use client";

import { usePortfolio } from "../lib/usePortfolio";
import { formatCurrency, formatTokenAmount } from "../lib/portfolioAnalytics";
import { useWallet } from "@solana/wallet-adapter-react";
import { WalletButton } from "./WalletButton";

export function Portfolio() {
  const { publicKey } = useWallet();
  const { data, isLoading, error } = usePortfolio();

  if (!publicKey) {
    return (
      <div className="rounded-2xl border border-slate-800/70 bg-slate-950/50 p-8 text-center backdrop-blur">
        <h3 className="text-xl font-semibold text-slate-100">Connect Your Wallet</h3>
        <p className="mt-2 text-sm text-slate-400">
          View your portfolio analytics and token holdings
        </p>
        <div className="mt-6 flex justify-center">
          <WalletButton />
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="rounded-2xl border border-slate-800/70 bg-slate-950/50 p-8 backdrop-blur">
        <div className="animate-pulse space-y-4">
          <div className="h-8 w-48 rounded bg-slate-800"></div>
          <div className="h-4 w-32 rounded bg-slate-800"></div>
          <div className="mt-6 space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-16 rounded-lg bg-slate-800"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-red-800/70 bg-red-950/20 p-8 backdrop-blur">
        <h3 className="text-xl font-semibold text-red-400">Error Loading Portfolio</h3>
        <p className="mt-2 text-sm text-red-300">{(error as Error).message}</p>
      </div>
    );
  }

  if (!data) {
    return null;
  }

  return (
    <div className="space-y-6">
      {/* Summary Card */}
      <div className="rounded-2xl border border-slate-800/70 bg-gradient-to-br from-slate-950/80 to-slate-900/50 p-6 backdrop-blur">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm uppercase tracking-wider text-slate-500">
              Total Portfolio Value
            </div>
            <div className="mt-2 text-4xl font-bold text-slate-50">
              {formatCurrency(data.totalValue)}
            </div>
            <div className="mt-2 text-xs text-slate-400">
              Last updated: {new Date(data.lastUpdated).toLocaleTimeString()}
            </div>
          </div>
          <div className="text-right">
            <div className="text-sm text-slate-500">Holdings</div>
            <div className="mt-1 text-2xl font-semibold text-primary">{data.tokens.length}</div>
            <div className="text-xs text-slate-500">tokens</div>
          </div>
        </div>
      </div>

      {/* Token List */}
      <div className="rounded-2xl border border-slate-800/70 bg-slate-950/50 backdrop-blur">
        <div className="border-b border-slate-800 px-6 py-4">
          <h3 className="text-lg font-semibold text-slate-100">Token Holdings</h3>
          <p className="mt-1 text-sm text-slate-400">View all tokens in your wallet</p>
        </div>

        <div className="divide-y divide-slate-800">
          {data.tokens.map((token) => (
            <div
              key={token.mint}
              className="flex items-center justify-between px-6 py-4 transition hover:bg-slate-900/30"
            >
              <div className="flex items-center gap-4">
                {token.logoUri ? (
                  <img
                    src={token.logoUri}
                    alt={token.symbol}
                    className="h-10 w-10 rounded-full"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = "none";
                    }}
                  />
                ) : (
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-800 text-sm font-semibold text-slate-400">
                    {token.symbol?.substring(0, 2) || "??"}
                  </div>
                )}

                <div>
                  <div className="font-semibold text-slate-100">{token.symbol || "Unknown"}</div>
                  <div className="text-xs text-slate-500">{token.name || "Unknown Token"}</div>
                </div>
              </div>

              <div className="text-right">
                <div className="font-medium text-slate-100">
                  {formatTokenAmount(token.uiAmount, 6)} {token.symbol}
                </div>
                {token.price !== undefined && token.value !== undefined && (
                  <>
                    <div className="text-sm text-accent">{formatCurrency(token.value)}</div>
                    <div className="text-xs text-slate-500">
                      @ {formatCurrency(token.price)}/token
                    </div>
                  </>
                )}
                {token.price === undefined && (
                  <div className="text-xs text-slate-500">Price unavailable</div>
                )}
              </div>
            </div>
          ))}

          {data.tokens.length === 0 && (
            <div className="px-6 py-12 text-center text-slate-500">
              No tokens found in this wallet
            </div>
          )}
        </div>
      </div>

      {/* Address Info */}
      <div className="rounded-lg border border-slate-800/50 bg-slate-900/30 p-4 text-xs">
        <div className="text-slate-500">Wallet Address</div>
        <div className="mt-1 font-mono text-slate-400">{publicKey.toString()}</div>
      </div>
    </div>
  );
}
