/** Read-only client for the Bloomerang REST API v2.
 *
 *  Auth is a private API key (an Administrator creates one under User
 *  Settings in Bloomerang) sent as X-API-KEY. The key grants full
 *  access to the Bloomerang database, so it lives only in the
 *  BLOOMERANG_API_KEY env var — never in the repo or the browser.
 *  This app only ever issues GET requests.
 *
 *  Spec: https://bloomerang.com/api/rest-api
 */

const BASE_URL = "https://api.bloomerang.co/v2";
const PAGE_SIZE = 50; // API maximum
const MAX_ATTEMPTS = 4;

export type Page<T> = {
  Total: number;
  TotalFiltered: number;
  Start: number;
  ResultCount: number;
  Results: T[];
};

export type Params = Record<string, string | number | undefined>;

export class BloomerangError extends Error {
  constructor(
    message: string,
    public status?: number,
  ) {
    super(message);
    this.name = "BloomerangError";
  }
}

export function isBloomerangConfigured(): boolean {
  return !!process.env.BLOOMERANG_API_KEY;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export type Fetcher = typeof fetch;

/** GET one page. Retries rate limits and server errors with backoff. */
export async function getPage<T>(
  path: string,
  params: Params,
  fetcher: Fetcher = fetch,
): Promise<Page<T>> {
  const key = process.env.BLOOMERANG_API_KEY;
  if (!key) throw new BloomerangError("BLOOMERANG_API_KEY is not set.");

  const url = new URL(BASE_URL + path);
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined) url.searchParams.set(k, String(v));
  }

  for (let attempt = 1; ; attempt++) {
    let res: Response;
    try {
      res = await fetcher(url, {
        headers: { "X-API-KEY": key, Accept: "application/json" },
        cache: "no-store",
      });
    } catch (e) {
      if (attempt >= MAX_ATTEMPTS) {
        throw new BloomerangError(`Could not reach Bloomerang: ${e instanceof Error ? e.message : e}`);
      }
      await sleep(500 * 2 ** attempt);
      continue;
    }

    if (res.ok) return (await res.json()) as Page<T>;

    if (res.status === 401 || res.status === 403) {
      throw new BloomerangError("Bloomerang rejected the API key. Check BLOOMERANG_API_KEY.", res.status);
    }
    if ((res.status === 429 || res.status >= 500) && attempt < MAX_ATTEMPTS) {
      const retryAfter = Number(res.headers.get("retry-after"));
      await sleep(Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : 500 * 2 ** attempt);
      continue;
    }
    throw new BloomerangError(`Bloomerang returned ${res.status} for ${path}.`, res.status);
  }
}

/** Walk every page of a list endpoint. */
export async function* pages<T>(
  path: string,
  params: Params,
  fetcher: Fetcher = fetch,
): AsyncGenerator<T[]> {
  for (let skip = 0; ; skip += PAGE_SIZE) {
    const page = await getPage<T>(path, { ...params, skip, take: PAGE_SIZE }, fetcher);
    if (page.Results.length) yield page.Results;
    if (page.Results.length < PAGE_SIZE || skip + page.Results.length >= page.TotalFiltered) return;
  }
}
