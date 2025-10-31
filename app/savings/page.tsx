"use client";

import { useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { useSavingsVaults } from "../../lib/useSavings";
import {
  TIME_PERIOD_OPTIONS,
  TimePeriod,
  calculateReward,
  formatUnlockDate,
  calculateUnlockDate,
} from "../../lib/timeUtils";
import { WalletButton } from "../../components/WalletButton";

export default function SavingsPage() {
  const { publicKey } = useWallet();
  const { data, isLoading } = useSavingsVaults();
  const [selectedPeriod, setSelectedPeriod] = useState<TimePeriod>("3months");
  const [depositAmount, setDepositAmount] = useState("100");
  const [showDepositModal, setShowDepositModal] = useState(false);

  const currentOption = TIME_PERIOD_OPTIONS.find((opt) => opt.value === selectedPeriod);
  const estimatedReward = currentOption
    ? calculateReward(Number(depositAmount), currentOption.apyBps, currentOption.slots)
    : 0;
  const unlockDate = currentOption
    ? calculateUnlockDate(Date.now() / 1000, currentOption.slots)
    : new Date();

  return (
    <div className="flex flex-col gap-8">
      <header className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-slate-100">Savings Vaults</h2>
          <p className="mt-1 text-sm text-slate-400">
            Lock tokens for preset terms and earn APY streamed from DAO reward pools.
          </p>
        </div>
        <WalletButton />
      </header>

      {/* Deposit Section */}
      <section className="rounded-2xl border border-slate-800/70 bg-slate-950/50 p-6 backdrop-blur">
        <h3 className="text-lg font-semibold text-slate-100">Create New Deposit</h3>
        <p className="mt-1 text-sm text-slate-400">
          Choose a time period and amount to start earning rewards
        </p>

        <div className="mt-6 grid gap-4 md:grid-cols-3">
          {TIME_PERIOD_OPTIONS.map((option) => (
            <button
              key={option.value}
              onClick={() => setSelectedPeriod(option.value)}
              className={`rounded-xl border p-4 text-left transition ${
                selectedPeriod === option.value
                  ? "border-primary bg-primary/10"
                  : "border-slate-800 bg-slate-900/40 hover:border-slate-700"
              }`}
            >
              <div className="text-lg font-semibold text-slate-100">{option.label}</div>
              <div className="mt-1 text-sm text-accent">{option.apyBps / 100}% APY</div>
              <div className="mt-2 text-xs text-slate-500">{option.description}</div>
            </button>
          ))}
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <label className="grid gap-2 text-xs uppercase text-slate-500">
            Deposit Amount
            <input
              type="number"
              min="0"
              step="0.01"
              value={depositAmount}
              onChange={(e) => setDepositAmount(e.target.value)}
              className="rounded-xl border border-slate-800 bg-slate-900/50 px-4 py-3 text-sm text-slate-100 focus:border-accent"
              placeholder="100"
            />
          </label>

          <div className="grid gap-2 text-xs uppercase text-slate-500">
            Estimated Rewards
            <div className="rounded-xl border border-slate-800 bg-slate-900/50 px-4 py-3 text-sm text-primary">
              +{estimatedReward.toFixed(4)} tokens
            </div>
          </div>
        </div>

        <div className="mt-4 rounded-lg border border-slate-800/50 bg-slate-900/30 p-4">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <div className="text-xs uppercase text-slate-500">Term Length</div>
              <div className="mt-1 text-slate-100">{currentOption?.label}</div>
            </div>
            <div>
              <div className="text-xs uppercase text-slate-500">Unlock Date</div>
              <div className="mt-1 text-slate-100">{formatUnlockDate(unlockDate)}</div>
            </div>
            <div>
              <div className="text-xs uppercase text-slate-500">Total Return</div>
              <div className="mt-1 text-accent">
                {(Number(depositAmount) + estimatedReward).toFixed(4)} tokens
              </div>
            </div>
            <div>
              <div className="text-xs uppercase text-slate-500">Slots</div>
              <div className="mt-1 text-slate-400">{currentOption?.slots.toLocaleString()}</div>
            </div>
          </div>
        </div>

        <button
          onClick={() => setShowDepositModal(true)}
          disabled={!publicKey || !depositAmount || Number(depositAmount) <= 0}
          className="mt-6 inline-flex w-full items-center justify-center rounded-full bg-gradient-to-r from-accent via-primary to-accent px-6 py-3 text-sm font-semibold text-slate-950 shadow-lg transition hover:shadow-[0_20px_45px_-25px_rgba(20,241,149,0.55)] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {publicKey ? "Create Deposit" : "Connect Wallet to Deposit"}
        </button>
      </section>

      {/* Existing Vaults */}
      <header className="flex flex-col gap-2">
        <h3 className="text-xl font-semibold text-slate-100">Active Vaults</h3>
        <p className="text-sm text-slate-400">View and manage your savings deposits</p>
      </header>

      <section className="grid gap-4 md:grid-cols-3">
        {isLoading &&
          Array.from({ length: 3 }).map((_, idx) => (
            <div
              key={`vault-skeleton-${idx}`}
              className="h-40 animate-pulse rounded-2xl border border-slate-800 bg-slate-900/20"
            />
          ))}

        {!isLoading && data?.vaults.map((vault) => (
          <article
            key={vault.vaultId}
            className="rounded-2xl border border-slate-800 bg-slate-900/40 p-6"
          >
            <h3 className="text-lg font-semibold text-slate-100">{vault.term}</h3>
            <p className="text-sm text-slate-400">{vault.apy}</p>
            <p className="mt-2 text-xs text-slate-500">Deposit mint: {vault.depositMint}</p>
            <p className="text-xs text-slate-500">Reward mint: {vault.rewardMint}</p>
            <p className="mt-3 text-sm text-primary">TVL {vault.tvl}</p>
            <p className="text-xs text-slate-500">Unlocks {vault.unlockDate}</p>
            <button className="mt-4 rounded-full border border-slate-700 px-4 py-2 text-sm text-slate-200 hover:bg-slate-800">
              Preview vault
            </button>
          </article>
        ))}
      </section>

      <section className="rounded-2xl border border-slate-800 bg-slate-900/40 p-6 text-sm text-slate-300">
        <h3 className="text-lg font-semibold text-slate-100">How rewards are paid</h3>
        <p className="mt-3">
          Serverless indexers monitor vault states and trigger `savings_vault::claim`
          instructions when epochs end, ensuring program-derived reward pools release
          yield pro-rata without a centralized backend.
        </p>
      </section>
    </div>
  );
}
