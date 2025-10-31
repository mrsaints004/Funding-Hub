interface Env {
  RPC_ENDPOINT: string;
  FUNDING_HUB_PROGRAM_ID: string;
  DAO_PASS_PROGRAM_ID?: string;
  GOVERNANCE_PROGRAM_ID?: string;
  SAVINGS_VAULT_PROGRAM_ID?: string;
  DATA_KV?: KVNamespace;
}

type RpcAccount = {
  pubkey: string;
  account: {
    data: [string, string];
    lamports: number;
  };
};

type Snapshot = {
  projects: ProjectSummary[];
  daos: DaoSummary[];
  proposals: ProposalSummary[];
  vaults: VaultSummary[];
  metrics: PlatformMetrics;
  generatedAt: string;
};

type ProjectSummary = {
  projectId: string;
  authority: string;
  mint: string;
  badgeMint: string;
  vault: string;
  targetAmount: string;
  pledged: string;
  deadlineTs: number;
  status: "Active" | "Successful" | "Failed";
};

type DaoSummary = {
  dao: string;
  authority: string;
  passMint: string;
  sponsorMint: string;
  sponsorVault: string;
  maxRelaySpend: string;
  relaySpent: string;
  totalMembers: number;
};

type ProposalSummary = {
  proposal: string;
  realm: string;
  proposer: string;
  metadata: string;
  proposalId: string;
  yesVotes: string;
  noVotes: string;
  votingStartSlot: number;
  votingEndSlot: number;
  status: "Pending" | "Succeeded" | "Defeated";
};

type VaultSummary = {
  vault: string;
  authority: string;
  depositMint: string;
  rewardMint: string;
  vaultTokenAccount: string;
  rewardVault: string;
  termSlots: number;
  apyBps: number;
  totalDeposited: string;
};

type PlatformMetrics = {
  totalProjects: number;
  totalDaos: number;
  totalVaults: number;
  totalPledged: string;
};

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname === "/health") {
      return Response.json({ ok: true, timestamp: new Date().toISOString() });
    }

    const snapshot = await loadSnapshot(env);

    switch (url.pathname) {
      case "/snapshot":
        return Response.json(snapshot);
      case "/projects":
        return Response.json({ projects: snapshot.projects, metrics: snapshot.metrics });
      case "/daos":
        return Response.json({ daos: snapshot.daos });
      case "/governance":
        return Response.json({ proposals: snapshot.proposals });
      case "/savings":
        return Response.json({ vaults: snapshot.vaults });
      default:
        return new Response("Not found", { status: 404 });
    }
  },

  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext) {
    ctx.waitUntil(refreshSnapshot(env));
  }
};

async function loadSnapshot(env: Env): Promise<Snapshot> {
  if (env.DATA_KV) {
    const cached = await env.DATA_KV.get("snapshot");
    if (cached) {
      return JSON.parse(cached) as Snapshot;
    }
  }
  return refreshSnapshot(env);
}

async function refreshSnapshot(env: Env): Promise<Snapshot> {
  const projects = await fetchProjects(env);
  const daos = env.DAO_PASS_PROGRAM_ID ? await fetchDaos(env) : [];
  const proposals = env.GOVERNANCE_PROGRAM_ID ? await fetchProposals(env) : [];
  const vaults = env.SAVINGS_VAULT_PROGRAM_ID ? await fetchVaults(env) : [];

  const totalPledged = projects
    .reduce((acc, item) => acc + BigInt(item.pledged), 0n)
    .toString();

  const snapshot: Snapshot = {
    projects,
    daos,
    proposals,
    vaults,
    metrics: {
      totalProjects: projects.length,
      totalDaos: daos.length,
      totalVaults: vaults.length,
      totalPledged,
    },
    generatedAt: new Date().toISOString(),
  };

  if (env.DATA_KV) {
    await env.DATA_KV.put("snapshot", JSON.stringify(snapshot), { expirationTtl: 60 });
  }

  return snapshot;
}

async function fetchProjects(env: Env): Promise<ProjectSummary[]> {
  const accounts = await getProgramAccounts(env, env.FUNDING_HUB_PROGRAM_ID, 184);
  return accounts.map((entry) => parseProject(entry));
}

async function fetchDaos(env: Env): Promise<DaoSummary[]> {
  if (!env.DAO_PASS_PROGRAM_ID) return [];
  const accounts = await getProgramAccounts(env, env.DAO_PASS_PROGRAM_ID, 168);
  return accounts.map((entry) => parseDao(entry));
}

async function fetchProposals(env: Env): Promise<ProposalSummary[]> {
  if (!env.GOVERNANCE_PROGRAM_ID) return [];
  // Proposals are larger (discriminator + struct = 200 bytes)
  const accounts = await getProgramAccounts(env, env.GOVERNANCE_PROGRAM_ID);
  return accounts
    .filter((account) => account.account.data[0].length >= 8 + 200)
    .map((entry) => parseProposal(entry));
}

async function fetchVaults(env: Env): Promise<VaultSummary[]> {
  if (!env.SAVINGS_VAULT_PROGRAM_ID) return [];
  const accounts = await getProgramAccounts(env, env.SAVINGS_VAULT_PROGRAM_ID, 197);
  return accounts.map((entry) => parseVault(entry));
}

async function getProgramAccounts(env: Env, programId: string, dataSize?: number): Promise<RpcAccount[]> {
  const filters = dataSize ? [{ dataSize }] : [];
  const body = {
    jsonrpc: "2.0",
    id: "getProgramAccounts",
    method: "getProgramAccounts",
    params: [
      programId,
      {
        commitment: "confirmed",
        encoding: "base64",
        filters,
      },
    ],
  };

  const res = await fetch(env.RPC_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    throw new Error(`RPC request failed: ${res.status}`);
  }

  const json = await res.json<{ result: RpcAccount[]; error?: { message: string } }>();
  if ((json as any).error) {
    throw new Error(`RPC error: ${(json as any).error.message}`);
  }
  return json.result ?? [];
}

function parseProject(account: RpcAccount): ProjectSummary {
  const data = decodeBase64(account.account.data[0]);
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  let offset = 8; // skip discriminator

  const projectId = view.getBigUint64(offset, true);
  offset += 8;
  offset += 8; // project_id_seed
  const authority = readPubkey(view, offset);
  offset += 32;
  const mint = readPubkey(view, offset);
  offset += 32;
  const badgeMint = readPubkey(view, offset);
  offset += 32;
  const vault = readPubkey(view, offset);
  offset += 32;
  const targetAmount = view.getBigUint64(offset, true);
  offset += 8;
  const deadlineTs = Number(view.getBigInt64(offset, true));
  offset += 8;
  const totalPledged = view.getBigUint64(offset, true);
  offset += 8;
  const status = view.getUint8(offset);

  return {
    projectId: projectId.toString(),
    authority,
    mint,
    badgeMint,
    vault,
    targetAmount: targetAmount.toString(),
    pledged: totalPledged.toString(),
    deadlineTs,
    status: statusToString(status),
  };
}

function parseDao(account: RpcAccount): DaoSummary {
  const data = decodeBase64(account.account.data[0]);
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  let offset = 8;

  const authority = readPubkey(view, offset);
  offset += 32;
  const passMint = readPubkey(view, offset);
  offset += 32;
  const sponsorMint = readPubkey(view, offset);
  offset += 32;
  const sponsorVault = readPubkey(view, offset);
  offset += 32;
  const maxRelaySpend = view.getBigUint64(offset, true);
  offset += 8;
  const relaySpent = view.getBigUint64(offset, true);
  offset += 8;
  offset += 8; // relay_epoch
  const totalMembers = view.getUint32(offset, true);

  return {
    dao: account.pubkey,
    authority,
    passMint,
    sponsorMint,
    sponsorVault,
    maxRelaySpend: maxRelaySpend.toString(),
    relaySpent: relaySpent.toString(),
    totalMembers,
  };
}

function parseProposal(account: RpcAccount): ProposalSummary {
  const data = decodeBase64(account.account.data[0]);
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  let offset = 8;

  const realm = readPubkey(view, offset);
  offset += 32;
  const proposer = readPubkey(view, offset);
  offset += 32;
  const metadata = readPubkey(view, offset);
  offset += 32;
  const proposalId = view.getBigUint64(offset, true);
  offset += 8;
  const votingStartSlot = Number(view.getBigUint64(offset, true));
  offset += 8;
  const votingEndSlot = Number(view.getBigUint64(offset, true));
  offset += 8;
  const yesVotes = view.getBigUint64(offset, true);
  offset += 8;
  const noVotes = view.getBigUint64(offset, true);
  offset += 8;
  const status = view.getUint8(offset);

  return {
    proposal: account.pubkey,
    realm,
    proposer,
    metadata,
    proposalId: proposalId.toString(),
    yesVotes: yesVotes.toString(),
    noVotes: noVotes.toString(),
    votingStartSlot,
    votingEndSlot,
    status: proposalStatusToString(status),
  };
}

function parseVault(account: RpcAccount): VaultSummary {
  const data = decodeBase64(account.account.data[0]);
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  let offset = 8;

  const authority = readPubkey(view, offset);
  offset += 32;
  offset += 8; // vault_id
  const depositMint = readPubkey(view, offset);
  offset += 32;
  const rewardMint = readPubkey(view, offset);
  offset += 32;
  const vaultTokenAccount = readPubkey(view, offset);
  offset += 32;
  const rewardVault = readPubkey(view, offset);
  offset += 32;
  const termSlots = Number(view.getBigUint64(offset, true));
  offset += 8;
  const apyBps = view.getUint16(offset, true);
  offset += 2;
  const totalDeposited = view.getBigUint64(offset, true);

  return {
    vault: account.pubkey,
    authority,
    depositMint,
    rewardMint,
    vaultTokenAccount,
    rewardVault,
    termSlots,
    apyBps,
    totalDeposited: totalDeposited.toString(),
  };
}

function decodeBase64(data: string): Uint8Array {
  const binary = atob(data);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

function readPubkey(view: DataView, offset: number): string {
  const bytes = new Uint8Array(view.buffer, view.byteOffset + offset, 32);
  return base58Encode(bytes);
}

function statusToString(status: number): "Active" | "Successful" | "Failed" {
  switch (status) {
    case 1:
      return "Successful";
    case 2:
      return "Failed";
    default:
      return "Active";
  }
}

function proposalStatusToString(status: number): "Pending" | "Succeeded" | "Defeated" {
  switch (status) {
    case 1:
      return "Succeeded";
    case 2:
      return "Defeated";
    default:
      return "Pending";
  }
}

const BASE58_ALPHABET = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";

function base58Encode(buffer: Uint8Array): string {
  if (buffer.length === 0) return "";

  let digits = [0];

  for (let i = 0; i < buffer.length; i += 1) {
    let carry = buffer[i];
    for (let j = 0; j < digits.length; j += 1) {
      const digit = digits[j] * 256 + carry;
      digits[j] = digit % 58;
      carry = Math.floor(digit / 58);
    }
    while (carry) {
      digits.push(carry % 58);
      carry = Math.floor(carry / 58);
    }
  }

  for (const byte of buffer) {
    if (byte === 0) {
      digits.push(0);
    } else {
      break;
    }
  }

  return digits
    .reverse()
    .map((digit) => BASE58_ALPHABET[digit])
    .join("");
}
