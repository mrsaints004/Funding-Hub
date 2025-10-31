/**
 * Portfolio Analytics Module
 * Fetches and analyzes wallet token holdings
 */

import { Connection, PublicKey } from "@solana/web3.js";
import { TOKEN_PROGRAM_ID } from "@solana/spl-token";

export interface TokenBalance {
  mint: string;
  amount: number;
  decimals: number;
  uiAmount: number;
  symbol?: string;
  name?: string;
  logoUri?: string;
  price?: number;
  value?: number;
}

export interface PortfolioSummary {
  totalValue: number;
  tokens: TokenBalance[];
  nftCount: number;
  lastUpdated: number;
}

export interface TokenMetadata {
  symbol: string;
  name: string;
  logoUri?: string;
  coingeckoId?: string;
}

// Known token registry (can be expanded or fetched from Jupiter)
const TOKEN_REGISTRY: Record<string, TokenMetadata> = {
  So11111111111111111111111111111111111111112: {
    symbol: "SOL",
    name: "Solana",
    logoUri: "https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/So11111111111111111111111111111111111111112/logo.png",
    coingeckoId: "solana",
  },
  EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v: {
    symbol: "USDC",
    name: "USD Coin",
    logoUri: "https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v/logo.png",
    coingeckoId: "usd-coin",
  },
  Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB: {
    symbol: "USDT",
    name: "Tether USD",
    logoUri: "https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB/logo.png",
    coingeckoId: "tether",
  },
};

/**
 * Fetch all token accounts for a wallet
 */
export async function getWalletTokenBalances(
  connection: Connection,
  walletAddress: PublicKey
): Promise<TokenBalance[]> {
  try {
    // Get SOL balance
    const solBalance = await connection.getBalance(walletAddress);

    // Get SPL token accounts
    const tokenAccounts = await connection.getParsedTokenAccountsByOwner(walletAddress, {
      programId: TOKEN_PROGRAM_ID,
    });

    const tokens: TokenBalance[] = [
      {
        mint: "So11111111111111111111111111111111111111112",
        amount: solBalance,
        decimals: 9,
        uiAmount: solBalance / 1e9,
        symbol: "SOL",
        name: "Solana",
        logoUri: TOKEN_REGISTRY["So11111111111111111111111111111111111111112"]?.logoUri,
      },
    ];

    for (const { account } of tokenAccounts.value) {
      const parsedInfo = account.data.parsed.info;
      const mint = parsedInfo.mint;
      const amount = parsedInfo.tokenAmount.amount;
      const decimals = parsedInfo.tokenAmount.decimals;
      const uiAmount = parsedInfo.tokenAmount.uiAmount;

      // Skip empty accounts
      if (uiAmount === 0) continue;

      const metadata = TOKEN_REGISTRY[mint];

      tokens.push({
        mint,
        amount: Number(amount),
        decimals,
        uiAmount,
        symbol: metadata?.symbol || "Unknown",
        name: metadata?.name || "Unknown Token",
        logoUri: metadata?.logoUri,
      });
    }

    return tokens;
  } catch (error) {
    console.error("Error fetching wallet token balances:", error);
    throw error;
  }
}

/**
 * Fetch token prices from CoinGecko or Jupiter
 */
export async function fetchTokenPrices(tokens: TokenBalance[]): Promise<Record<string, number>> {
  try {
    const coingeckoIds = tokens
      .map((t) => TOKEN_REGISTRY[t.mint]?.coingeckoId)
      .filter(Boolean);

    if (coingeckoIds.length === 0) {
      return {};
    }

    const response = await fetch(
      `https://api.coingecko.com/api/v3/simple/price?ids=${coingeckoIds.join(",")}&vs_currencies=usd`
    );

    if (!response.ok) {
      throw new Error("Failed to fetch prices from CoinGecko");
    }

    const data = await response.json();

    // Map coingecko IDs back to mint addresses
    const prices: Record<string, number> = {};
    for (const [mint, metadata] of Object.entries(TOKEN_REGISTRY)) {
      if (metadata.coingeckoId && data[metadata.coingeckoId]) {
        prices[mint] = data[metadata.coingeckoId].usd;
      }
    }

    return prices;
  } catch (error) {
    console.error("Error fetching token prices:", error);
    return {};
  }
}

/**
 * Calculate portfolio summary with values
 */
export async function getPortfolioSummary(
  connection: Connection,
  walletAddress: PublicKey
): Promise<PortfolioSummary> {
  const tokens = await getWalletTokenBalances(connection, walletAddress);
  const prices = await fetchTokenPrices(tokens);

  let totalValue = 0;
  const tokensWithValue = tokens.map((token) => {
    const price = prices[token.mint] || 0;
    const value = token.uiAmount * price;
    totalValue += value;

    return {
      ...token,
      price,
      value,
    };
  });

  // Sort by value (descending)
  tokensWithValue.sort((a, b) => (b.value || 0) - (a.value || 0));

  return {
    totalValue,
    tokens: tokensWithValue,
    nftCount: 0, // TODO: Implement NFT counting
    lastUpdated: Date.now(),
  };
}

/**
 * Format currency value
 */
export function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

/**
 * Format token amount
 */
export function formatTokenAmount(amount: number, decimals: number = 6): string {
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: decimals,
  }).format(amount);
}
