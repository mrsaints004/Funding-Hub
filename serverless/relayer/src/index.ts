import { ComputeBudgetProgram, Connection, Keypair, PublicKey, Transaction, VersionedTransaction } from "@solana/web3.js";
import bs58 from "bs58";

type RelayPayload = {
  dao: string;
  serializedTransaction: string; // base64 or base58
  encoding?: "base64" | "base58";
  maxComputeUnitPrice?: number;
};

type RelayResponse = {
  signature: string;
  relayed: boolean;
};

interface Env {
  FEE_PAYER_SECRET: string;
  RPC_ENDPOINT: string;
  ALLOWED_PROGRAM_IDS?: string;
  DAO_PASS_PROGRAM_ID?: string;
  DAO_INDEX_URL?: string;
}

const DEFAULT_ALLOWED = [
  "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA", // SPL Token
  "JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4", // Jupiter V6
  "JUP4Fb2cqiRUcaTHdrPC8h2gNsA2ETXiPDD33WcGuJB", // Jupiter V4 (legacy)
  "whirLbMiicVdio4qvUfM5KAg6Ct8VwpYzGff3uctyCc", // Whirlpool (Orca)
  "675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8", // Raydium AMM
  "ComputeBudget111111111111111111111111111111", // Compute Budget
  "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL", // Associated Token
];

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method !== "POST") {
      return new Response("Method not allowed", { status: 405 });
    }

    let payload: RelayPayload;
    try {
      payload = await request.json<RelayPayload>();
    } catch (error) {
      return Response.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    if (!payload.serializedTransaction || !payload.dao) {
      return Response.json({ error: "Missing serializedTransaction or dao" }, {
        status: 400
      });
    }

    try {
      const connection = new Connection(env.RPC_ENDPOINT, {
        commitment: "confirmed",
        disableRetryOnRateLimit: true
      });

      const feePayer = Keypair.fromSecretKey(bs58.decode(env.FEE_PAYER_SECRET));
      const allowedPrograms = new Set(
        (env.ALLOWED_PROGRAM_IDS ?? DEFAULT_ALLOWED.join(","))
          .split(",")
          .map((id) => id.trim())
          .filter(Boolean)
      );

      // Validate DAO sponsorship policy via cached indexer (optional but recommended)
      if (env.DAO_INDEX_URL) {
        await validateDaoBudget(env.DAO_INDEX_URL, payload.dao);
      }

      let rawTx: Uint8Array;
      if (payload.encoding === "base58") {
        rawTx = bs58.decode(payload.serializedTransaction);
      } else {
        const binary = atob(payload.serializedTransaction);
        rawTx = Uint8Array.from(binary, (char) => char.charCodeAt(0));
      }

      // Try to parse as VersionedTransaction first (for Jupiter swaps)
      let signature: string;
      try {
        const versionedTx = VersionedTransaction.deserialize(rawTx);

        // Verify all program IDs are allowed
        const message = versionedTx.message;
        const accountKeys = message.staticAccountKeys;

        for (const ix of message.compiledInstructions) {
          const programId = accountKeys[ix.programIdIndex].toBase58();
          if (!allowedPrograms.has(programId)) {
            throw new Error(`Program ${programId} not allowlisted for sponsorship`);
          }
        }

        // Sign and send versioned transaction
        versionedTx.sign([feePayer]);
        signature = await connection.sendTransaction(versionedTx, {
          skipPreflight: false,
          maxRetries: 3
        });
      } catch (versionedError) {
        // Fallback to legacy Transaction
        const transaction = Transaction.from(rawTx);
        transaction.feePayer = feePayer.publicKey;

        enforceAllowedPrograms(transaction, allowedPrograms);

        // Optionally adjust compute price for priority fees
        if (payload.maxComputeUnitPrice) {
          transaction.instructions.unshift(
            ComputeBudgetProgram.setComputeUnitPrice({
              microLamports: payload.maxComputeUnitPrice
            })
          );
        }

        const { blockhash } = await connection.getLatestBlockhash();
        transaction.recentBlockhash = blockhash;

        transaction.sign(feePayer);

        signature = await connection.sendRawTransaction(transaction.serialize(), {
          skipPreflight: false,
          maxRetries: 3
        });
      }

      const response: RelayResponse = { signature, relayed: true };
      return Response.json(response, { status: 202 });
    } catch (error) {
      return Response.json({ error: (error as Error).message }, { status: 500 });
    }
  }
};

async function validateDaoBudget(indexUrl: string, dao: string): Promise<void> {
  const res = await fetch(indexUrl, { cf: { cacheTtl: 15 } });
  if (!res.ok) {
    throw new Error(`DAO index fetch failed: ${res.status}`);
  }
  const data = await res.json<{ daos: Array<{ daoId: string; relaySpent: number; maxRelaySpend: number }> }>();
  const entry = data.daos.find((item) => item.daoId === dao);
  if (!entry) {
    throw new Error(`DAO ${dao} not registered for sponsorship`);
  }
  if (entry.relaySpent >= entry.maxRelaySpend) {
    throw new Error(`DAO ${dao} relay budget exhausted`);
  }
}

function enforceAllowedPrograms(transaction: Transaction, allowlist: Set<string>) {
  for (const ix of transaction.instructions) {
    const programId = ix.programId.toBase58();
    if (!allowlist.has(programId)) {
      throw new Error(`Program ${programId} not allowlisted for sponsorship`);
    }
  }
}
