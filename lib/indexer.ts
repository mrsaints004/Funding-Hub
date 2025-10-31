type FetchOptions<T> = {
  path: string;
  fallback: T;
};

export async function fetchIndexer<T>({ path, fallback }: FetchOptions<T>): Promise<T> {
  const base = process.env.INDEXER_URL ?? process.env.NEXT_PUBLIC_INDEXER_URL;
  if (!base) {
    return fallback;
  }

  const url = new URL(path, base).toString();

  try {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) {
      console.warn(`[indexer] request failed ${res.status} ${url}`);
      return fallback;
    }
    return (await res.json()) as T;
  } catch (error) {
    console.warn(`[indexer] request error for ${url}:`, error);
    return fallback;
  }
}
