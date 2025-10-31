import "./globals.css";
import { ReactNode } from "react";
import { Metadata } from "next";
import { Providers } from "../components/Providers";
import { WalletButton } from "../components/WalletButton";

export const metadata: Metadata = {
  title: "Solana Funding Hub",
  description:
    "Community crowdfunding, DAO coordination, and savings tooling built on Solana."
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="text-slate-100 antialiased">
        <Providers>
          <div className="mx-auto flex min-h-screen max-w-7xl flex-col gap-12 px-6 py-10 md:px-10">
            <header className="group relative rounded-2xl border border-slate-800/60 bg-slate-900/30 px-6 py-5 backdrop-blur-lg transition-all duration-300 hover:border-accent/80 hover:shadow-[0_0_35px_rgba(20,241,149,0.25)]">
              <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
                <div>
                  <div className="inline-flex items-center gap-2 rounded-full border border-accent/40 bg-accent/10 px-4 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-accent transition-colors duration-300 group-hover:border-accent group-hover:bg-accent/20">
                    Solana Native Platform
                  </div>
                  <h1 className="mt-4 text-3xl font-semibold text-slate-50 md:text-4xl">
                    Funding Hub
                  </h1>
                  <p className="mt-2 max-w-xl text-sm text-slate-400 md:text-base">
                    Launch community crowdfunding campaigns, coordinate DAOs, and manage savings vaults
                    with gas-sponsored experiences on Solana.
                  </p>
                </div>
                <div className="flex flex-col items-start gap-4 md:items-end">
                <WalletButton />
                <nav className="flex flex-nowrap items-center gap-2 overflow-x-auto md:justify-end">
                  {[
                    { label: "Home", href: "/" },
                    { label: "Dashboard", href: "/dashboard" },
                    { label: "DAOs", href: "/dao" },
                    { label: "Savings", href: "/savings" },
                    { label: "Swap", href: "/swap" },
                    { label: "Vault", href: "/dao/deposit" },
                    { label: "Launch", href: "/projects/submit" }
                  ].map((item) => (
                    <a
                      key={item.href}
                      href={item.href}
                      className="whitespace-nowrap rounded-full border border-transparent bg-slate-900/40 px-4 py-2 text-sm text-slate-300 transition-all duration-200 hover:border-accent/60 hover:bg-slate-900/70 hover:text-slate-50"
                    >
                      {item.label}
                    </a>
                  ))}
                </nav>
              </div>
              </div>
            </header>
            <main className="flex-1">{children}</main>
            <footer className="rounded-2xl border border-slate-800/60 bg-slate-900/40 px-6 py-6 text-xs text-slate-500 backdrop-blur">
              Built for the Solana ecosystem — gas sponsored swaps, on-chain governance, and
              serverless analytics working in concert.
            </footer>
          </div>
        </Providers>
      </body>
    </html>
  );
}
