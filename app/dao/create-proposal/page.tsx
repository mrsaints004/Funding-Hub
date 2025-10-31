"use client";

import { useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { WalletButton } from "../../../components/WalletButton";

export default function CreateProposalPage() {
  const { publicKey } = useWallet();
  const [daoAddress, setDaoAddress] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [votingStartDelay, setVotingStartDelay] = useState("3600"); // 1 hour in seconds
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!publicKey) {
      setError("Please connect your wallet");
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch("/api/governance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          daoAddress,
          proposerPubkey: publicKey.toString(),
          title,
          description,
          votingStartDelay: Number(votingStartDelay),
        }),
      });

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.error || "Failed to create proposal");
      }

      const result = await response.json();
      setSuccess(`Proposal created successfully! Proposal ID: ${result.proposalId}`);

      // Reset form
      setTitle("");
      setDescription("");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-8">
      <header className="rounded-2xl border border-slate-800/70 bg-slate-900/40 px-6 py-8 backdrop-blur">
        <div className="flex items-center justify-between">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-primary/40 bg-primary/10 px-4 py-1 text-[11px] uppercase tracking-[0.25em] text-primary">
              Governance
            </div>
            <h2 className="mt-4 text-3xl font-semibold text-slate-50">Create DAO Proposal</h2>
            <p className="mt-2 text-sm text-slate-400">
              Submit a proposal for your DAO members to vote on
            </p>
          </div>
          <WalletButton />
        </div>
      </header>

      <form
        onSubmit={handleSubmit}
        className="space-y-6 rounded-2xl border border-slate-800/70 bg-slate-950/50 px-6 py-8 backdrop-blur"
      >
        <label className="grid gap-2 text-xs uppercase text-slate-500">
          DAO Address
          <input
            type="text"
            value={daoAddress}
            onChange={(e) => setDaoAddress(e.target.value)}
            placeholder="Enter your DAO address"
            className="rounded-xl border border-slate-800 bg-slate-900/50 px-4 py-3 font-mono text-sm text-slate-100 focus:border-accent"
            required
          />
        </label>

        <label className="grid gap-2 text-xs uppercase text-slate-500">
          Proposal Title
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Enter a clear, concise title"
            className="rounded-xl border border-slate-800 bg-slate-900/50 px-4 py-3 text-sm text-slate-100 focus:border-accent"
            required
            maxLength={100}
          />
          <span className="text-xs text-slate-600">{title.length}/100 characters</span>
        </label>

        <label className="grid gap-2 text-xs uppercase text-slate-500">
          Description
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Provide detailed information about your proposal"
            className="min-h-[150px] rounded-xl border border-slate-800 bg-slate-900/50 px-4 py-3 text-sm text-slate-100 focus:border-accent"
            required
            maxLength={1000}
          />
          <span className="text-xs text-slate-600">{description.length}/1000 characters</span>
        </label>

        <label className="grid gap-2 text-xs uppercase text-slate-500">
          Voting Start Delay (seconds)
          <select
            value={votingStartDelay}
            onChange={(e) => setVotingStartDelay(e.target.value)}
            className="rounded-xl border border-slate-800 bg-slate-900/50 px-4 py-3 text-sm text-slate-100 focus:border-accent"
          >
            <option value="3600">1 hour</option>
            <option value="21600">6 hours</option>
            <option value="86400">24 hours</option>
            <option value="259200">3 days</option>
          </select>
          <span className="text-xs text-slate-600">
            Time before voting begins (allows for discussion)
          </span>
        </label>

        <div className="rounded-lg border border-slate-800/50 bg-slate-900/30 p-4">
          <h4 className="text-sm font-semibold text-slate-100">Proposal Guidelines</h4>
          <ul className="mt-2 space-y-1 text-xs text-slate-400">
            <li>• Be clear and specific about what you're proposing</li>
            <li>• Include any relevant links or resources</li>
            <li>• Consider the impact on all DAO members</li>
            <li>• Allow sufficient time for discussion before voting</li>
          </ul>
        </div>

        {error && (
          <div className="rounded-lg border border-red-800/50 bg-red-950/20 p-4 text-sm text-red-400">
            {error}
          </div>
        )}

        {success && (
          <div className="rounded-lg border border-green-800/50 bg-green-950/20 p-4 text-sm text-green-400">
            {success}
          </div>
        )}

        <button
          type="submit"
          disabled={loading || !publicKey}
          className="inline-flex w-full items-center justify-center rounded-full bg-gradient-to-r from-accent via-primary to-accent px-6 py-3 text-sm font-semibold text-slate-950 shadow-lg transition hover:shadow-[0_20px_45px_-25px_rgba(20,241,149,0.55)] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? "Creating proposal..." : publicKey ? "Create Proposal" : "Connect Wallet"}
        </button>
      </form>

      <section className="rounded-2xl border border-slate-800/70 bg-slate-900/40 p-6 text-sm text-slate-300">
        <h3 className="text-lg font-semibold text-slate-100">How Governance Works</h3>
        <div className="mt-4 space-y-3">
          <div>
            <h4 className="font-medium text-slate-200">1. Proposal Creation</h4>
            <p className="mt-1 text-slate-400">
              Any DAO member can create a proposal. Proposals require a clear title and description.
            </p>
          </div>
          <div>
            <h4 className="font-medium text-slate-200">2. Discussion Period</h4>
            <p className="mt-1 text-slate-400">
              After creation, there's a delay before voting begins to allow for community discussion.
            </p>
          </div>
          <div>
            <h4 className="font-medium text-slate-200">3. Voting</h4>
            <p className="mt-1 text-slate-400">
              DAO members vote with their membership weight. Votes are recorded on-chain.
            </p>
          </div>
          <div>
            <h4 className="font-medium text-slate-200">4. Finalization</h4>
            <p className="mt-1 text-slate-400">
              After the voting period ends, proposals are finalized based on quorum and approval thresholds.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
