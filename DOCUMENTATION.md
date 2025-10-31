# Funding Hub - Complete Documentation

## Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Smart Contracts](#smart-contracts)
4. [Frontend Application](#frontend-application)
5. [Serverless Services](#serverless-services)
6. [Development Guide](#development-guide)
7. [Deployment](#deployment)
8. [API Reference](#api-reference)
9. [Testing](#testing)
10. [Security](#security)

---

## Overview

Funding Hub is a decentralized crowdfunding platform built on Solana that combines:

- **Crowdfunding** with NFT contribution badges
- **DAO governance** with on-chain voting
- **Fee sponsorship** for gasless user experience
- **Savings vaults** with time-locked deposits and APY rewards
- **Token swaps** via Jupiter aggregator integration

### Key Features

- ✅ Create funding projects with target goals and deadlines
- ✅ Pledge SPL tokens and receive NFT badges (Metaplex Token Metadata v4)
- ✅ Launch DAOs with membership NFTs and sponsor vaults
- ✅ Create and vote on governance proposals
- ✅ Lock tokens in savings vaults for yield
- ✅ Swap tokens seamlessly with Jupiter integration
- ✅ Track portfolio analytics and investment returns

---

## Architecture

### High-Level System Design

```
┌─────────────────────────────────────────────────────────┐
│                    Frontend (Next.js)                    │
│  - Project Creation  - DAO Management  - Swap Interface │
│  - Governance Voting - Portfolio Dashboard              │
└────────────────┬────────────────────────────────────────┘
                 │
       ┌─────────┴──────────┐
       │                    │
┌──────▼──────┐    ┌────────▼─────────┐
│  Solana RPC │    │ Serverless Layer │
│  (Devnet)   │    │  - Indexer       │
└──────┬──────┘    │  - Relayer       │
       │           └──────────────────┘
       │
┌──────▼────────────────────────────────┐
│      Solana Programs (Anchor)         │
│  ┌────────────┐  ┌──────────────┐   │
│  │ Funding    │  │ DAO Pass     │   │
│  │ Hub        │  │              │   │
│  └────────────┘  └──────────────┘   │
│  ┌────────────┐  ┌──────────────┐   │
│  │ Governance │  │ Savings      │   │
│  │            │  │ Vault        │   │
│  └────────────┘  └──────────────┘   │
└───────────────────────────────────────┘
```

### Technology Stack

**Blockchain Layer:**
- Solana blockchain (devnet)
- Anchor Framework 0.30.1
- Rust 1.75+
- SPL Token Program
- Metaplex Token Metadata v4

**Application Layer:**
- Next.js 14 (App Router)
- React 18
- TypeScript 5
- TailwindCSS
- Solana Wallet Adapter
- React Query

**Serverless Layer:**
- Cloudflare Workers
- Vercel Edge Functions
- Scheduled cron jobs

---

## Smart Contracts

### 1. Funding Hub (`funding_hub`)

**Program ID:** `B8gKYNx3LGJVpsAzY72ufrNJj6WZVf8KTodiz1Mex62u`

#### Instructions

##### `initialize_project`
Creates a new crowdfunding project with NFT badge mint.

**Parameters:**
- `project_id: u64` - Unique project identifier
- `target_amount: u64` - Funding goal in lamports/tokens
- `deadline_ts: i64` - Unix timestamp deadline
- `project_name: String` - Project name (max 100 chars)
- `badge_symbol: String` - NFT badge symbol (max 10 chars)
- `badge_uri: String` - Metadata URI (max 200 chars)

**Accounts:**
- `authority` - Project creator (signer, mut)
- `project` - Project PDA (init, mut)
- `mint` - Funding token mint
- `project_vault` - Token escrow (ATA, init, mut)
- `badge_mint` - NFT badge mint (init, signer, mut)
- `badge_metadata` - Metaplex metadata account (mut)
- `token_metadata_program` - Metaplex program
- `sysvar_instructions` - Instructions sysvar

**PDA Seeds:** `["project", authority, project_id_bytes]`

##### `pledge`
Contribute tokens to a project and receive NFT badge.

**Parameters:**
- `amount: u64` - Token amount to pledge

**Accounts:**
- `donor` - Contributor (signer, mut)
- `donor_token_account` - Source token account (mut)
- `project` - Project PDA (mut)
- `project_vault` - Escrow (mut)
- `badge_mint` - NFT mint (mut)
- `donor_badge_account` - Donor's badge account (init_if_needed, mut)

**Logic:**
- Transfers tokens to project vault
- Mints 1 NFT badge if donor doesn't have one
- Updates `total_pledged` counter

##### `finalize_project`
Closes project after deadline or goal reached.

**Parameters:** None

**Accounts:**
- `authority` - Project creator (signer)
- `project` - Project PDA (mut)

**Logic:**
- Checks deadline passed OR goal reached
- Sets status to `Successful` or `Failed`

##### `withdraw`
Project creator withdraws funds from successful project.

**Parameters:**
- `amount: u64` - Amount to withdraw

**Accounts:**
- `authority` - Project creator (signer)
- `project` - Project PDA (mut)
- `project_vault` - Escrow (mut)
- `authority_token_account` - Destination (mut)

**Requires:** Project status = `Successful`

#### Account Structures

```rust
pub struct Project {
    pub project_id: u64,
    pub project_id_seed: [u8; 8],
    pub authority: Pubkey,
    pub mint: Pubkey,
    pub badge_mint: Pubkey,
    pub vault: Pubkey,
    pub target_amount: u64,
    pub deadline_ts: i64,
    pub total_pledged: u64,
    pub status: ProjectStatus, // Active | Successful | Failed
    pub bump: u8,
    pub reserved: [u8; 6],
}
```

**Space:** 186 bytes (8 discriminator + 178 data)

---

### 2. DAO Pass (`dao_pass`)

**Program ID:** `Dz9WAiHQDGLK8K8puZosdUux3UAJMRTKTfWJFqRve4Dk`

#### Instructions

##### `initialize_dao`
Creates a new DAO with membership NFT mint.

**Parameters:**
- `name_seed: [u8; 8]` - DAO name seed
- `pass_symbol: String` - Membership NFT symbol
- `pass_uri: String` - NFT metadata URI
- `max_relay_spend: u64` - Max sponsor budget per period

**Accounts:**
- `authority` - DAO creator (signer, mut)
- `dao` - DAO PDA (init, mut)
- `pass_mint` - Membership NFT mint (init, signer, mut)
- `pass_metadata` - Metaplex metadata (mut)
- `sponsor_vault` - Fee sponsor vault (ATA, init, mut)

**PDA Seeds:** `["dao", authority, name_seed]`

##### `issue_pass`
Mints membership NFT to new member.

**Parameters:** None

**Accounts:**
- `member_wallet` - New member (signer, mut)
- `dao` - DAO PDA (mut)
- `pass_mint` - NFT mint (mut)
- `member_pass_account` - Member's NFT account (init_if_needed, mut)
- `member` - Member record PDA (init_if_needed, mut)

**Logic:**
- Mints 1 membership NFT
- Creates member record
- Increments `total_members` count

#### Account Structures

```rust
pub struct Dao {
    pub authority: Pubkey,
    pub name_seed: [u8; 8],
    pub pass_mint: Pubkey,
    pub sponsor_vault: Pubkey,
    pub max_relay_spend: u64,
    pub relay_spent: u64,
    pub total_members: u64,
    pub bump: u8,
    pub reserved: [u8; 7],
}

pub struct Member {
    pub dao: Pubkey,
    pub owner: Pubkey,
    pub membership_mint: Pubkey,
    pub member_pass_account: Pubkey,
    pub joined_ts: i64,
    pub bump: u8,
}
```

---

### 3. Governance (`governance`)

**Program ID:** `6pCiN5ZUf5GCY3hJ8YiWL27apECaobGPLVVsSi51rrUq`

#### Instructions

##### `create_realm`
Initializes a governance realm.

**Parameters:**
- `name_seed: [u8; 8]` - Realm identifier
- `voting_mint: Pubkey` - Token for voting weight
- `min_quorum: u64` - Minimum participation (basis points)
- `approval_threshold: u64` - Required approval (basis points)
- `voting_period_slots: u64` - Duration in slots
- `dao_address: Option<Pubkey>` - Optional DAO link

**PDA Seeds:** `["realm", authority, name_seed]`

##### `create_proposal`
Submits a new proposal.

**Parameters:**
- `proposal_id: u64` - Unique identifier
- `metadata_uri: Pubkey` - IPFS/Arweave URI
- `voting_start_slot: u64` - Start time

**PDA Seeds:** `["proposal", realm, proposal_id_bytes]`

##### `cast_vote`
Vote on a proposal.

**Parameters:**
- `support: bool` - true = yes, false = no
- `weight: u64` - Voting power

**Accounts:**
- `voter` - Voter wallet (signer, mut)
- `realm` - Governance realm
- `proposal` - Proposal PDA (mut)
- `vote_record` - Vote record PDA (init, mut)

**PDA Seeds:** `["vote", proposal, voter]`

##### `finalize_proposal`
Closes proposal and determines outcome.

**Logic:**
- Checks voting ended
- Calculates quorum and approval ratio
- Sets status to `Succeeded` or `Defeated`

#### Account Structures

```rust
pub struct Realm {
    pub authority: Pubkey,
    pub voting_mint: Pubkey,
    pub dao_address: Pubkey,
    pub name_seed: [u8; 8],
    pub min_quorum: u64,
    pub approval_threshold: u64,
    pub voting_period_slots: u64,
    pub proposal_count: u64,
    pub bump: u8,
}

pub struct Proposal {
    pub realm: Pubkey,
    pub proposer: Pubkey,
    pub metadata_uri: Pubkey,
    pub proposal_id: u64,
    pub voting_start_slot: u64,
    pub voting_end_slot: u64,
    pub yes_votes: u64,
    pub no_votes: u64,
    pub status: ProposalStatus, // Pending | Succeeded | Defeated
    pub bump: u8,
}

pub struct VoteRecord {
    pub proposal: Pubkey,
    pub voter: Pubkey,
    pub support: bool,
    pub weight: u64,
    pub bump: u8,
}
```

---

### 4. Savings Vault (`savings_vault`)

**Program ID:** `HSnBJMRi1uipcnGeSRcM7kCD1DegertD93CgtKmn18tN`

#### Instructions

##### `initialize_vault`
Creates a savings vault.

**Parameters:**
- `vault_id: [u8; 8]` - Vault identifier
- `term_slots: u64` - Lock duration
- `apy_bps: u16` - APY in basis points

**PDA Seeds:** `["vault", authority, vault_id]`

##### `deposit`
Locks tokens in vault.

**Parameters:**
- `amount: u64` - Token amount

**Logic:**
- Transfers tokens to vault
- Creates deposit receipt
- Sets unlock slot = current + term_slots

##### `claim`
Withdraws principal + rewards after unlock.

**Logic:**
- Checks unlock_slot reached
- Calculates reward based on APY
- Transfers principal + reward to user

#### Account Structures

```rust
pub struct Vault {
    pub authority: Pubkey,
    pub vault_id: [u8; 8],
    pub deposit_mint: Pubkey,
    pub reward_mint: Pubkey,
    pub vault_token_account: Pubkey,
    pub reward_vault: Pubkey,
    pub term_slots: u64,
    pub apy_bps: u16,
    pub total_deposited: u64,
    pub bump: u8,
}

pub struct DepositReceipt {
    pub vault: Pubkey,
    pub owner: Pubkey,
    pub amount: u64,
    pub start_slot: u64,
    pub unlock_slot: u64,
    pub claimed: bool,
    pub bump: u8,
}
```

**Reward Formula:**
```
reward = (amount * apy_bps * term_slots) / (10_000 * SLOTS_PER_YEAR)
```

---

## Frontend Application

### Project Structure

```
app/
├── admin/
│   └── projects/          # Admin dashboard
├── api/
│   ├── dao/              # DAO data endpoints
│   ├── governance/       # Proposal endpoints
│   ├── portfolio/        # Analytics
│   ├── projects/         # Project CRUD
│   ├── relayer/          # Transaction relay
│   ├── savings/          # Vault data
│   └── swap/             # Jupiter integration
├── dao/
│   ├── create-proposal/  # New DAO proposal
│   └── deposit/          # Sponsor vault deposit
├── dashboard/            # Main dashboard
├── projects/
│   ├── create/           # New project form
│   └── submit/           # Project submission
├── savings/              # Savings vaults
└── swap/                 # Token swap UI

components/
├── Portfolio.tsx         # Portfolio widget
├── ProjectsGrid.tsx      # Project cards
├── ProposalList.tsx      # Governance list
├── Providers.tsx         # Wallet/Query providers
└── WalletButton.tsx      # Wallet connect

lib/
├── constants.ts          # Program IDs
├── indexer.ts            # Indexer client
├── portfolioAnalytics.ts # Analytics logic
├── solana.ts             # RPC connection
├── storage.ts            # File storage
├── timeUtils.ts          # Time helpers
├── transactions.ts       # Transaction builders
├── useDao.ts             # DAO hooks
├── useGovernance.ts      # Governance hooks
├── usePortfolio.ts       # Portfolio hooks
├── useProjects.ts        # Project hooks
└── useSavings.ts         # Savings hooks
```

### Key Components

#### Transaction Builders (`lib/transactions.ts`)

**Initialize Project:**
```typescript
export async function buildInitializeProjectTx({
  connection,
  wallet,
  projectId,
  projectName,
  badgeSymbol,
  badgeUri,
  targetAmount,
  deadlineTs,
  mint
}: InitializeProjectParams): Promise<InitializeProjectResult>
```

**Pledge to Project:**
```typescript
export async function buildPledgeTx({
  connection,
  wallet,
  projectPda,
  amount,
  mint
}: PledgeParams): Promise<Transaction>
```

#### React Hooks

**useProjects:**
```typescript
export function useProjects() {
  return useQuery<ProjectsResponse>({
    queryKey: ["projects"],
    queryFn: async () => {
      const res = await fetch("/api/projects");
      return res.json();
    }
  });
}
```

**usePortfolio:**
```typescript
export function usePortfolio(walletAddress?: string) {
  return useQuery<PortfolioData>({
    queryKey: ["portfolio", walletAddress],
    queryFn: async () => {
      const res = await fetch(`/api/portfolio?wallet=${walletAddress}`);
      return res.json();
    },
    enabled: !!walletAddress
  });
}
```

### Environment Variables

Create `.env.local`:

```env
# Solana Network
NEXT_PUBLIC_SOLANA_RPC=https://api.devnet.solana.com

# Indexer Service
NEXT_PUBLIC_INDEXER_URL=https://your-indexer.workers.dev
INDEXER_URL=https://your-indexer.workers.dev

# Relayer Service
RELAYER_URL=https://your-relayer.workers.dev

# Optional: Custom RPC
# NEXT_PUBLIC_SOLANA_RPC=https://your-custom-rpc.com
```

---

## Serverless Services

### Indexer (`serverless/indexer`)

**Purpose:** Aggregates on-chain data into cached JSON endpoints.

**Technology:** Cloudflare Workers with KV storage

**Endpoints:**
- `GET /projects` - All active projects
- `GET /daos` - All DAOs with stats
- `GET /governance` - Active proposals
- `GET /savings` - Savings vaults

**Deployment:**
```bash
cd serverless/indexer
npm install
wrangler deploy
```

**Configuration (`wrangler.toml`):**
```toml
[vars]
RPC_ENDPOINT = "https://api.devnet.solana.com"
FUNDING_HUB_PROGRAM_ID = "B8gKYNx3LGJVpsAzY72ufrNJj6WZVf8KTodiz1Mex62u"
DAO_PASS_PROGRAM_ID = "Dz9WAiHQDGLK8K8puZosdUux3UAJMRTKTfWJFqRve4Dk"
GOVERNANCE_PROGRAM_ID = "6pCiN5ZUf5GCY3hJ8YiWL27apECaobGPLVVsSi51rrUq"
SAVINGS_VAULT_PROGRAM_ID = "HSnBJMRi1uipcnGeSRcM7kCD1DegertD93CgtKmn18tN"

[triggers]
crons = ["*/15 * * * *"]  # Run every 15 minutes
```

### Relayer (`serverless/relayer`)

**Purpose:** Pays transaction fees for DAO members.

**Technology:** Cloudflare Workers with secret management

**Logic:**
1. Receives partially signed transaction
2. Verifies DAO membership (checks NFT ownership)
3. Checks sponsor budget
4. Signs as fee payer
5. Submits to RPC

**Deployment:**
```bash
cd serverless/relayer
npm install
wrangler secret put FEE_PAYER_SECRET
wrangler deploy
```

---

## Development Guide

### Prerequisites

```bash
# Install Rust
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh

# Install Solana CLI
sh -c "$(curl -sSfL https://release.solana.com/stable/install)"

# Install Anchor
cargo install --git https://github.com/coral-xyz/anchor anchor-cli --tag v0.30.1

# Verify installations
rustc --version
solana --version
anchor --version
node --version  # Should be 18+
```

### Local Development

```bash
# 1. Clone repository
git clone https://github.com/mrsaints004/Funding-Hub.git
cd Funding-Hub

# 2. Install dependencies
npm install

# 3. Build Anchor programs
anchor build

# 4. Start local validator (optional)
solana-test-validator

# 5. Deploy to localnet (optional)
anchor deploy

# 6. Start Next.js dev server
npm run dev
```

### Testing Smart Contracts

```bash
# Run Anchor tests
anchor test

# Run specific test file
anchor test -- --test funding_hub

# Test with local validator
anchor test --skip-local-validator
```

### Code Quality

```bash
# Format Rust code
cargo fmt --all

# Lint Rust code
cargo clippy --all-targets

# Format TypeScript/React
npm run lint

# Type check
npx tsc --noEmit
```

---

## Deployment

### Deploy Smart Contracts

**Devnet Deployment:**

```bash
# 1. Set Solana to devnet
solana config set --url devnet

# 2. Create/fund wallet
solana-keygen new -o ~/.config/solana/id.json
solana airdrop 2

# 3. Build programs
anchor build

# 4. Deploy
anchor deploy

# 5. Update program IDs in:
# - Anchor.toml
# - programs/*/src/lib.rs (declare_id!)
# - lib/constants.ts

# 6. Rebuild and redeploy
anchor build
anchor deploy
```

**Mainnet Deployment:**

```bash
# 1. Switch to mainnet
solana config set --url mainnet-beta

# 2. Fund deployment wallet (requires SOL)
# Cost: ~5-10 SOL per program

# 3. Deploy
anchor deploy --provider.cluster mainnet

# 4. Verify on Solana Explorer
```

### Deploy Frontend (Vercel)

**Via CLI:**
```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel --prod
```

**Via GitHub:**
1. Push to GitHub
2. Connect repository to Vercel
3. Configure environment variables
4. Deploy automatically on push

**Environment Variables (Vercel):**
- `NEXT_PUBLIC_SOLANA_RPC`
- `NEXT_PUBLIC_INDEXER_URL`
- `INDEXER_URL`
- `RELAYER_URL`

### Deploy Serverless Workers

**Indexer:**
```bash
cd serverless/indexer
wrangler login
wrangler deploy
```

**Relayer:**
```bash
cd serverless/relayer

# Set secrets
wrangler secret put FEE_PAYER_SECRET
# Paste base58 private key

wrangler deploy
```

---

## API Reference

### REST Endpoints

#### `GET /api/projects`
Returns all active funding projects.

**Response:**
```json
{
  "projects": [
    {
      "projectId": "abc123",
      "authority": "8fK...",
      "title": "Community Garden",
      "description": "...",
      "targetAmount": 10000000000,
      "totalPledged": 5000000000,
      "deadline": "2025-12-31T00:00:00Z",
      "status": "Active",
      "badgeMint": "BNf...",
      "contributorsCount": 42
    }
  ]
}
```

#### `POST /api/projects/submit`
Submits new project for approval.

**Request:**
```json
{
  "title": "My Project",
  "summary": "Short description",
  "description": "Full description",
  "fundingGoal": 1000000000,
  "fundingMint": "So11....",
  "proposer": "8fK..."
}
```

#### `GET /api/dao`
Returns DAO list with stats.

**Response:**
```json
{
  "daos": [
    {
      "daoId": "alpha-dao",
      "name": "AlphaDAO",
      "passMint": "DPm...",
      "members": 812,
      "maxRelaySpend": "5000000000",
      "relaySpent": "1240000000"
    }
  ]
}
```

#### `GET /api/governance`
Returns active proposals.

**Response:**
```json
{
  "proposals": [
    {
      "proposalId": "prop-42",
      "realm": "AlphaDAO",
      "title": "Upgrade treasury",
      "status": "Pending",
      "yesVotes": "120000",
      "noVotes": "8000",
      "quorum": "Reached"
    }
  ]
}
```

#### `GET /api/portfolio?wallet={address}`
Returns portfolio analytics for wallet.

**Response:**
```json
{
  "totalValue": 15.42,
  "tokens": [...],
  "nfts": [...],
  "activeInvestments": [...],
  "returns": {
    "total": 2.5,
    "percentage": 19.3
  }
}
```

#### `POST /api/swap/quote`
Gets swap quote from Jupiter.

**Request:**
```json
{
  "inputMint": "So11...",
  "outputMint": "EPj...",
  "amount": 1000000000,
  "slippageBps": 50
}
```

#### `POST /api/swap/execute`
Executes Jupiter swap.

**Request:**
```json
{
  "quoteResponse": {...},
  "userPublicKey": "8fK..."
}
```

---

## Testing

### Unit Tests

**Smart Contracts:**
```bash
anchor test
```

**Frontend:**
```bash
npm test
```

### Integration Tests

**Test Project Creation Flow:**
```bash
anchor test --test funding_hub_integration
```

### Manual Testing Checklist

**Funding Hub:**
- [ ] Create project with valid params
- [ ] Pledge tokens to project
- [ ] Receive NFT badge
- [ ] Finalize successful project
- [ ] Withdraw funds as creator

**DAO Pass:**
- [ ] Initialize DAO
- [ ] Issue membership pass
- [ ] Verify member record created

**Governance:**
- [ ] Create realm
- [ ] Submit proposal
- [ ] Cast votes
- [ ] Finalize with correct outcome

**Savings Vault:**
- [ ] Create vault with APY
- [ ] Deposit tokens
- [ ] Wait for unlock
- [ ] Claim with rewards

---

## Security

### Audit Considerations

**Smart Contract Security:**
- ✅ Input validation on all parameters
- ✅ Overflow protection (checked math)
- ✅ PDA verification
- ✅ Signer verification
- ✅ Account ownership checks
- ✅ Re-entrancy protection

**Best Practices:**
- Use Anchor's built-in security features
- Validate all account relationships
- Check program ownership
- Verify token mints match expected
- Implement access controls
- Use PDAs for program authorities

### Known Limitations

1. **Devnet Only**: Current deployment is on devnet for testing
2. **No Multi-sig**: Project creators are single authority
3. **Fixed Reward**: Savings vault APY is set at creation
4. **No Refunds**: Failed projects don't auto-refund (manual withdrawal needed)

### Responsible Disclosure

Found a security issue? Please email: security@fundinghub.dev

---

## Troubleshooting

### Common Issues

**Build Failures:**
```bash
# Clear build cache
rm -rf target/ .anchor/

# Rebuild
anchor build
```

**RPC Rate Limits:**
```bash
# Use custom RPC in .env.local
NEXT_PUBLIC_SOLANA_RPC=https://your-rpc-url
```

**Transaction Failures:**
- Check wallet has sufficient SOL for fees
- Verify account ownership
- Confirm program addresses are correct
- Check transaction expiration

---

## Contributing

We welcome contributions! Please follow these guidelines:

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests
5. Submit a pull request

**Code Style:**
- Rust: Follow `rustfmt` conventions
- TypeScript: ESLint + Prettier
- Commits: Conventional commits format

---

## License

MIT License - see LICENSE file for details.

---

## Support

- **GitHub Issues**: [Report bugs](https://github.com/mrsaints004/Funding-Hub/issues)
- **Discussions**: [Ask questions](https://github.com/mrsaints004/Funding-Hub/discussions)
- **Discord**: [Join community](#)

---

**Built with ❤️ on Solana**
