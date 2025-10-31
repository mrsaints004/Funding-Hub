# Edge Indexer

Scheduled serverless worker that scans Anchor accounts and materializes JSON payloads consumed by the Next.js app.

Responsibilities:

- Poll `funding_hub` project PDAs and compute aggregate metrics (TVL, pledges, deadlines).
- Ingest `dao_pass` and `governance` accounts to expose DAO sponsorship and proposal states.
- Store cached responses in KV / D1 / Supabase for fast reads consumed by `/api/*` routes.
- Generate donation badge metadata snapshots used by the wallet dashboard.
- Trigger `savings_vault::claim`/reward top-ups when vault epochs expire (via signed transactions or keeper bots).

Outputs:

- `projects.json` – list of funding vaults with computed fields.
- `dao.json` – cached sponsor + membership metrics for relayer policies.
- `governance.json` – proposal snapshots for dashboards.
- `metrics.json` – aggregated numbers for the homepage header.
- `portfolio/{wallet}.json` – optional wallet analytics for UI hydration.
