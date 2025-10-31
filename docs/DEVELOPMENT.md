# Development Workflow

## Prerequisites

- Rust toolchain + Anchor CLI (`anchor --version` → 0.32.x recommended).
- Solana CLI for account management and localnet testing.
- Node.js 20+ with npm or pnpm for the Next.js client.
- Access to an RPC endpoint (local validator, QuickNode, Helius, etc.).

## Local Setup

1. **Install dependencies**
   ```bash
   npm install
   anchor build
   ```
   > Building the Anchor workspace requires downloading crates from crates.io. If your network is sandboxed, run these commands outside the sandbox first.

   Optional helper scripts: `npm run anchor:build` and `npm run anchor:test` mirror the Anchor CLI commands when Node scripts are preferred.

2. **Run a local validator**
   ```bash
   solana-test-validator -r
   anchor deploy
   ```

3. **Start the web app**
   ```bash
   npm run dev
   ```
   The app consumes mocked `/api/projects` data until the serverless indexer is deployed.

## Serverless Components

- **Relayer Worker (`serverless/relayer`)**: Signs transactions as the DAO fee payer. Suggested hosting: Cloudflare Workers or Supabase Edge Functions. Bindings include the sponsor keypair, RPC endpoint, and DAO allowlists.
- **Indexer Worker (`serverless/indexer`)**: Scheduled task that scans Anchor accounts, caching JSON payloads and triggering reward distributions.
- **Static Assets**: NFT metadata and proposal documents should be uploaded via a client-side flow to Bundlr/Arweave or IPFS pinning services (e.g., Pinata serverless gateway).

### Deploying the Workers

```bash
cd serverless/relayer
npm install
wrangler dev --remote
# set secrets
wrangler secret put FEE_PAYER_SECRET
wrangler deploy

cd ../indexer
npm install
wrangler dev --remote
wrangler deploy
```

> The indexer exposes `/snapshot`, `/projects`, `/daos`, `/governance`, and `/savings` routes. Point the Next.js API routes to these endpoints once deployed to remove mocked data.

## Program Architecture

- `funding_hub`: Manages project lifecycle and escrow vaults for pledges, now minting donor NFTs through the Metaplex Token Metadata CPI path.
- `dao_pass`: Mints membership NFTs, tracks sponsor treasuries, and rate-limits gas sponsorship via `record_relay_spend`.
- `governance`: Lightweight proposal + voting state machine compatible with Realm-style workflows.
- `savings_vault`: Time-locked deposits with APY accrual and keeper-friendly claim flows.

### Client Integration

- IDLs for every program live in `idl/`. Consumers can import them directly (e.g. `import fundingHubIdl from "../idl/funding_hub.json"`) to instantiate Anchor `Program` objects.
- Transaction builder helpers are exported from `lib/transactions.ts` (`buildInitializeProjectTx`, `buildPledgeTx`). They leverage the IDLs to craft unsigned transactions that front-end wallets can sign and relay.
- `ProjectsGrid` and the project creation page already demonstrate how to serialize transactions to base64 so they can be forwarded to the relayer worker when desired.
- Set `INDEXER_URL` (or `NEXT_PUBLIC_INDEXER_URL` for client-side usage) to the deployed indexer worker so API routes fetch real-time program snapshots instead of fallback mocks.
- Project submissions are persisted in `storage/pending-projects.json` until admin approval (see `/projects/submit` and `/admin/projects`). Approved entries are promoted to `storage/approved-projects.json` and surfaced to the public APIs.

## Testing Strategy

- Anchor integration tests (`tests/`) will simulate project initialization, pledging, and withdrawals.
- Front-end uses mocked API responses; React Testing Library can validate flows once components solidify.
- Serverless workers should include unit tests (Wrangler / Vitest) that sign mock transactions and enforce policy checks.

## Deployment

1. Deploy Anchor programs to devnet via `anchor deploy --provider.cluster Devnet`.
2. Publish workers using Wrangler (Cloudflare) or Supabase CLI.
3. Promote Next.js app to Vercel/Cloudflare Pages with environment variables:
   - `NEXT_PUBLIC_SOLANA_RPC`
   - `NEXT_PUBLIC_NETWORK` (optional for switching between clusters)
4. Point `/api/projects` to the indexer cache once available.

## Immediate Next Steps

1. Point the Next.js API routes at the deployed indexer worker (set `INDEXER_URL` env) so real account snapshots populate the UI.
2. Extend `dao_pass` and `governance` with cross-program validations (e.g., gated voting weights, collection verification) and add Anchor tests.
3. Integrate donor badge NFT metadata uploads using Bundlr/Arweave from the front-end flow.
4. Add CI workflows for Anchor builds/tests and Next.js linting, including IDL exports.
