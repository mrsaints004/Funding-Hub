# Funding Hub 🚀

> A Solana-powered crowdfunding platform with NFT badges, DAO governance, savings vaults, and Jupiter token swaps built on Anchor and Next.js.

**Live Demo**: [funding-hub-chi.vercel.app](https://funding-hub-chi.vercel.app)

This repository houses a Solana-first, serverless-friendly platform that enables community-led funding, DAO coordination, and portfolio tooling without relying on a traditional backend. The system is organized into modular programs and lightweight off-chain services so that each feature can evolve independently while staying decentralized.

## High-Level Architecture

- **Solana Programs**
  - `funding_hub`: Crowdfunding vaults, pledge tracking, donation NFT mint authority.
  - `dao_pass`: DAO membership badges, sponsor vaults for fee-relayed swaps.
  - `governance`: Proposal lifecycle (draft → active → voting → execution).
  - `savings_vault`: Time-locked deposits with reward distribution control.
- **Serverless Services**
  - Cloud Functions/Workers act as transaction relayers that pay compute fees from DAO sponsor vaults when members swap.
  - Metadata + media (proposal docs, NFT assets) pinned to IPFS/Arweave via upload endpoints that never store user keys.
  - Indexer/cron jobs (Supabase Edge Functions, Cloudflare Workers, or AWS Lambda) aggregate program accounts into cached JSON views for the UI.
- **Client Applications**
  - Next.js front-end deployed to a serverless host (Vercel, Cloudflare Pages) using RPC providers (Helius, Triton, or custom RPC) to read/write on-chain data.
  - Embedded wallet adapters (e.g. Solana Wallet Adapter) perform client-side signing; relayer service only pays fees when requested by DAO-authorized members.

## Data & Accounts Overview

| Component       | Solana Accounts | Notes |
|-----------------|-----------------|-------|
| Funding project | `Project` PDA + SPL token escrow ATA + optional NFT mint authority PDA | Holds project metadata hash, target amount, status. Donations deposit into escrow and mint donor badge NFTs through Metaplex standard. |
| DAO membership  | `Dao` PDA + `Member` PDA + sponsor treasury ATA | DAO NFT mint used as membership badge. Sponsor treasury funds CPI to SPL token swapper with relayer as fee payer. |
| Governance      | `GovRealm` PDA + `Proposal` PDA + `VoteRecord` PDA | Supports DAO-local or platform-wide voting with customizable quorum/threshold. |
| Savings vault   | `Vault` PDA + `Deposit` PDA | Enforces cliff duration (3, 6, 12 months) and tracks accrued reward share. Rewards emitted from program-controlled reward ATA. |

All PDAs derive from predictable seeds so indexers can discover and cache them.

## 📦 Deployed Programs (Solana Devnet)

| Program | Address | Description |
|---------|---------|-------------|
| **Funding Hub** | `B8gKYNx3LGJVpsAzY72ufrNJj6WZVf8KTodiz1Mex62u` | Crowdfunding with NFT badges |
| **DAO Pass** | `Dz9WAiHQDGLK8K8puZosdUux3UAJMRTKTfWJFqRve4Dk` | DAO membership & fee sponsorship |
| **Governance** | `6pCiN5ZUf5GCY3hJ8YiWL27apECaobGPLVVsSi51rrUq` | On-chain voting & proposals |
| **Savings Vault** | `HSnBJMRi1uipcnGeSRcM7kCD1DegertD93CgtKmn18tN` | Time-locked deposits with APY |

🔗 [View on Solana Explorer](https://explorer.solana.com/?cluster=devnet)

## Serverless Workflow

1. **Proposal Creation**: Client uploads proposal metadata blob (JSON + media) to IPFS via a serverless upload endpoint, stores hash on-chain using `funding_hub::create_project` or `governance::create_proposal`.
2. **Donations & Badges**: Contributors sign a pledge transaction. Program escrows tokens and emits a donation badge NFT using a delegated mint authority; metadata URI references IPFS content.
3. **Gas-Sponsored Swaps**: Member crafts swap instruction locally. Client forwards the partially signed transaction to a relayer function. Relayer verifies DAO membership proof (NFT ownership) and fee budget, then signs as fee payer using the DAO sponsor treasury.
4. **Savings**: Users deposit tokens into a time-locked vault. Off-chain cron job reads vault state and distributes rewards when epochs end by triggering program instructions.
5. **Portfolio Analytics**: Serverless indexer aggregates SPL balances, NFT holdings, and open commitments into precomputed JSON snapshots consumed by the front-end dashboards.

## Technology Choices

- **On-chain**: Anchor framework (Rust) for ergonomic Solana program development.
- **Token Standards**: SPL tokens, Metaplex Certified Collection for NFTs.
- **Governance**: Custom Anchor program compatible with Realms-style vote weights.
- **Front-end**: Next.js 14 (App Router), TailwindCSS, Solana Wallet Adapter, React Query.
- **Serverless**: Cloudflare Workers/Supabase Edge Functions for relayers & indexers; scheduled workflows for reward distribution.
- **Storage**: Bundlr/Arweave or Pinata/IPFS for NFT metadata and proposal attachments.
- **IDLs & Client Builders**: Anchor IDLs are versioned in `idl/` and React helpers in `lib/transactions.ts` craft initialize/pledge transactions using wallet adapter context.

## Initial Milestones

1. **MVP Funding Hub**
   - Anchor workspace with `funding_hub` program.
   - Project creation, pledge/deposit, withdrawal flows.
   - Donation badge NFT minting via CPI into Token Metadata program.
2. **DAO Sponsor Layer**
   - `dao_pass` program for membership NFT + sponsor treasury configuration.
   - Serverless relayer that pays transaction fees for whitelisted instructions.
3. **Governance**
   - Proposal + voting program with DAO- or platform-scoped configurations.
4. **Savings Vault**
   - Time-locked deposits with configurable terms and reward stream.
5. **UX & Analytics**
   - Next.js dashboard, wallet integration, cached analytics endpoint.

## Repository Layout (Target)

```
solana1/
├── programs/
│   ├── funding_hub/
│   ├── dao_pass/
│   ├── governance/
│   └── savings_vault/
├── app/                 # Next.js app
├── serverless/
│   ├── relayer/
│   └── indexer/
├── Anchor.toml
├── package.json
└── README.md
```

This initial commit starts with documentation and scaffolding. Subsequent steps implement the Anchor programs, serverless functions, and front-end components iteratively.

See `docs/DEVELOPMENT.md` for local setup, testing, and deployment guidance.

## Serverless Components

- `serverless/relayer`: Cloudflare Worker template that validates DAO sponsorship budgets and re-signs pledge/swap transactions from approved programs. Configure `FEE_PAYER_SECRET`, `RPC_ENDPOINT`, and program allowlists in `wrangler.toml`.
- `serverless/indexer`: Scheduled worker that snapshots program state (funding projects, DAO treasuries, governance proposals, savings vaults) and exposes JSON endpoints consumed by the Next.js API routes. Optional KV caching keeps responses warm for the UI.

Both workers include `package.json` files ready for `npm install`, `wrangler dev`, and `wrangler deploy` flows.

## Application Features

- **Project submission & approval** – founders submit campaigns at `/projects/submit`; the admin dashboard (`/admin/projects`) reviews, approves, or rejects them. Approved projects are merged into the public feed (`/dashboard`, `/`), ready for pledges.
- **Wallet-native pledging** – project cards generate unsigned pledge transactions (SOL/SPL) and optional relayer payloads. Donors receive badge NFTs via the on-chain program.
- **DAO sponsor management** – `/dao/deposit` crafts sponsor vault deposit transactions so relayers can cover compute fees for members.
- **Swap workstation** – `/swap` offers a staging UI for token swaps, ready to plug into Jupiter or a custom DEX aggregator; outputs relay-ready payloads.

## Environment Variables

Configure the web app via `.env.local`:

| Variable | Description |
|----------|-------------|
| `NEXT_PUBLIC_SOLANA_RPC` | RPC endpoint for the wallet adapter (defaults to devnet when unset). |
| `NEXT_PUBLIC_INDEXER_URL` / `INDEXER_URL` | Base URL for the deployed indexer worker. API routes prefer the server-side `INDEXER_URL`. |
| `RELAYER_URL` | Server-side endpoint for the relayer worker consumed by `/api/relayer`. |

If the indexer or relayer URLs are omitted the application falls back to mocked data and returns unsigned transactions without forwarding them.

## 🚀 Quick Start

### Prerequisites

- Node.js 18+
- Rust 1.75+ & Anchor CLI 0.30.1
- Solana CLI 1.18+
- Phantom or Solflare wallet

### Installation

```bash
# Clone repository
git clone https://github.com/mrsaints004/Funding-Hub.git
cd Funding-Hub

# Install dependencies
npm install

# Build Anchor programs
anchor build

# Run development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to view the app.

## 📚 Full Documentation

See [DOCUMENTATION.md](./DOCUMENTATION.md) for comprehensive documentation including:

- Detailed architecture
- Smart contract specifications
- API reference
- Development & testing guide
- Deployment instructions

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 📄 License

MIT License - see LICENSE file for details.

## 🙏 Acknowledgments

Built with:
- [Solana](https://solana.com/) - High-performance blockchain
- [Anchor](https://anchor-lang.com/) - Solana development framework
- [Metaplex](https://www.metaplex.com/) - NFT standards
- [Jupiter](https://jup.ag/) - Token swap aggregator
- [Next.js](https://nextjs.org/) - React framework
