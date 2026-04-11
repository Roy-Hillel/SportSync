// ---------------------------------------------------------------------------
// API-Football v3 HTTP client
//
// Thin, typed HTTP wrapper. Handles auth and error surfacing.
// All callers receive validated data or a thrown error — never raw/unknown.
// Auth: x-apisports-key header (NOT Bearer, NOT x-api-key).
// ---------------------------------------------------------------------------

import { ZodSchema } from "zod";

const BASE_URL = "https://v3.football.api-sports.io";

export class ApiFootballApiError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
    public readonly endpoint: string
  ) {
    super(message);
    this.name = "ApiFootballApiError";
  }
}

export class ApiFootballClient {
  private readonly apiKey: string;

  constructor(apiKey: string) {
    if (!apiKey) throw new Error("API-Football API key is required");
    this.apiKey = apiKey;
  }

  async get<T>(
    endpoint: string,
    params: Record<string, string | number>,
    schema: ZodSchema<T>
  ): Promise<T> {
    const url = new URL(`${BASE_URL}${endpoint}`);
    for (const [k, v] of Object.entries(params)) {
      url.searchParams.set(k, String(v));
    }

    const response = await fetch(url.toString(), {
      headers: { "x-apisports-key": this.apiKey },
      // Use Next.js fetch cache: revalidate every 5 minutes at the HTTP layer.
      // The sync engine applies its own hash-based deduplication on top.
      next: { revalidate: 300 },
    });

    if (!response.ok) {
      throw new ApiFootballApiError(
        `API-Football error ${response.status}: ${response.statusText}`,
        response.status,
        endpoint
      );
    }

    const raw: unknown = await response.json();

    const parsed = schema.safeParse(raw);
    if (!parsed.success) {
      throw new Error(
        `API-Football response validation failed for ${endpoint}: ${parsed.error.message}`
      );
    }

    return parsed.data;
  }
}

// Singleton — one client per process, keyed off the API key env var.
let _client: ApiFootballClient | null = null;

export function getApiFootballClient(): ApiFootballClient {
  if (!_client) {
    const key = process.env.API_FOOTBALL_KEY;
    if (!key) throw new Error("API_FOOTBALL_KEY environment variable is not set");
    _client = new ApiFootballClient(key);
  }
  return _client;
}
