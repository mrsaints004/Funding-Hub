"use client";

import { useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { WalletButton } from "../../../components/WalletButton";

type FormState = {
  title: string;
  summary: string;
  description: string;
  fundingGoal: string;
  fundingMint: string;
  metadataUri: string;
  deadline: string;
};

export default function SubmitProjectPage() {
  const { publicKey } = useWallet();
  const [state, setState] = useState<FormState>({
    title: "",
    summary: "",
    description: "",
    fundingGoal: "",
    fundingMint: "So11111111111111111111111111111111111111112", // Default to SOL
    metadataUri: "",
    deadline: ""
  });
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<"idle" | "success" | "error">("idle");
  const [message, setMessage] = useState<string | null>(null);

  const onChange = (key: keyof FormState) => (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setState((prev) => ({ ...prev, [key]: event.target.value }));
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!publicKey) {
      setResult("error");
      setMessage("Please connect your wallet first");
      return;
    }

    setSubmitting(true);
    setResult("idle");
    setMessage(null);

    try {
      const res = await fetch("/api/projects/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: state.title,
          summary: state.summary,
          description: state.description,
          fundingGoal: Number(state.fundingGoal),
          fundingMint: state.fundingMint,
          metadataUri: state.metadataUri || undefined,
          deadline: state.deadline,
          proposer: publicKey.toString()
        })
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? `Submission failed (${res.status})`);
      }

      setResult("success");
      setMessage("Project submitted successfully! Pending approval.");
      setState({
        title: "",
        summary: "",
        description: "",
        fundingGoal: "",
        fundingMint: "So11111111111111111111111111111111111111112",
        metadataUri: "",
        deadline: ""
      });
    } catch (error) {
      setResult("error");
      setMessage((error as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-10">
      <header className="rounded-2xl border border-slate-800/70 bg-slate-900/50 px-6 py-8 backdrop-blur">
        <div className="flex items-center justify-between">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-accent/40 bg-accent/10 px-4 py-1 text-[11px] uppercase tracking-[0.25em] text-accent">
              Submit Project
            </div>
            <h2 className="mt-4 text-3xl font-semibold text-slate-50">Launch Your Campaign</h2>
            <p className="mt-2 text-sm text-slate-400">
              Create a funding campaign for your project. Connect your wallet and provide details about your vision,
              funding goals, and timeline.
            </p>
          </div>
          <WalletButton />
        </div>

        {!publicKey && (
          <div className="mt-6 rounded-lg border border-yellow-800/50 bg-yellow-950/20 p-4 text-sm text-yellow-400">
            ⚠️ Please connect your wallet to submit a project
          </div>
        )}
      </header>

      <form
        onSubmit={handleSubmit}
        className="space-y-6 rounded-2xl border border-slate-800/70 bg-slate-950/50 px-6 py-8 shadow-[0_30px_60px_-45px_rgba(153,69,255,0.45)] backdrop-blur"
      >
        <Field
          label="Project Title"
          placeholder="e.g. Solar Microgrid for Lagos"
          value={state.title}
          onChange={onChange("title")}
          required
        />
        <Field
          label="Executive Summary"
          placeholder="One line summary of the funding campaign"
          value={state.summary}
          onChange={onChange("summary")}
          required
        />
        <TextArea
          label="Detailed Description"
          placeholder="Describe the project goals, impact, roadmap, and how funds will be utilized."
          value={state.description}
          onChange={onChange("description")}
          required
        />
        <div className="grid gap-4 md:grid-cols-2">
          <Field
            label="Funding Goal (Lamports or Token Units)"
            type="number"
            min={1}
            value={state.fundingGoal}
            onChange={onChange("fundingGoal")}
            placeholder="1000000000"
            required
          />
          <Field
            label="Funding Mint (SOL mint for native SOL contributions)"
            value={state.fundingMint}
            onChange={onChange("fundingMint")}
            placeholder="So11111111111111111111111111111111111111112"
            required
          />
        </div>
        <Field
          label="Deadline (Date)"
          type="date"
          value={state.deadline}
          onChange={onChange("deadline")}
          required
        />
        <Field
          label="Metadata URI (optional)"
          value={state.metadataUri}
          onChange={onChange("metadataUri")}
          placeholder="https://arweave.net/... (optional badge/project metadata)"
        />

        {publicKey && (
          <div className="rounded-lg border border-slate-800/50 bg-slate-900/30 p-4 text-sm">
            <div className="text-slate-500">Project Creator (Your Wallet)</div>
            <div className="mt-1 font-mono text-xs text-slate-400">{publicKey.toString()}</div>
          </div>
        )}

        <button
          type="submit"
          disabled={submitting || !publicKey}
          className="inline-flex items-center justify-center rounded-full bg-gradient-to-r from-accent via-primary to-accent px-6 py-3 text-sm font-semibold text-slate-950 shadow-lg transition-all duration-300 hover:shadow-[0_20px_45px_-25px_rgba(153,69,255,0.55)] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {submitting ? "Submitting…" : !publicKey ? "Connect Wallet to Submit" : "Submit Project"}
        </button>

        {result !== "idle" && (
          <p className={`text-sm ${result === "success" ? "text-primary" : "text-red-400"}`}>
            {message}
          </p>
        )}
      </form>
    </div>
  );
}

type FieldProps = {
  label: string;
  value: string;
  placeholder?: string;
  onChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
  type?: string;
  min?: number;
  required?: boolean;
};

function Field({ label, value, placeholder, onChange, type = "text", min, required }: FieldProps) {
  return (
    <label className="grid gap-2 text-xs uppercase text-slate-500">
      {label}
      <input
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        type={type}
        min={min}
        required={required}
        className="rounded-xl border border-slate-800 bg-slate-900/50 px-4 py-3 text-sm text-slate-100 transition focus:border-accent"
      />
    </label>
  );
}

type TextAreaProps = {
  label: string;
  value: string;
  placeholder?: string;
  onChange: (event: React.ChangeEvent<HTMLTextAreaElement>) => void;
  required?: boolean;
};

function TextArea({ label, value, placeholder, onChange, required }: TextAreaProps) {
  return (
    <label className="grid gap-2 text-xs uppercase text-slate-500">
      {label}
      <textarea
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        required={required}
        className="min-h-[160px] rounded-xl border border-slate-800 bg-slate-900/50 px-4 py-3 text-sm text-slate-100 transition focus:border-accent"
      />
    </label>
  );
}
