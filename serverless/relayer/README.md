# Gas Sponsor Relayer (Serverless)

Cloudflare Worker or Supabase Edge function that:

1. Receives serialized swap transactions from the `/api/relayer` endpoint.
2. Verifies DAO membership badge via `dao_pass` program and checks per-epoch budgets.
3. Rehydrates the transaction, assigns the worker-held fee payer, and submits to RPC.
4. Logs execution state to Durable Objects / Supabase for auditability and invokes `dao_pass::record_relay_spend` to meter usage.

Environment variables:

- `FEE_PAYER_SECRET` – base58 encoded keypair for the DAO/relayer treasury.
- `ALLOWED_PROGRAM_IDS` – CSV of swap program IDs allowed for sponsorship.
- `RPC_ENDPOINT` – High-throughput RPC (Helius, Triton, etc.).
- `DAO_PASS_PROGRAM_ID` – Program ID for `dao_pass` to fetch DAO config + relay budgets.
