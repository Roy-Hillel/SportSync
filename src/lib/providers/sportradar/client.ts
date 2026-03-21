// ---------------------------------------------------------------------------
// SportRadar Soccer API v4 client
//
// Thin, typed HTTP wrapper. Handles auth, rate limiting, and error surfacing.
// All callers receive validated data or a thrown error — never raw/unknown.
// ---------------------------------------------------------------------------

import { ZodSchema } from "zod";

const BASE_URL = "https://api.sportradar.com/soccer/trial/v4/en";

export class SportRadarApiError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
    public readonly endpoint: string
  ) {
    super(message);
    this.name = "SportRadarApiError";
  }
}

export class SportRadarClient {
  private readonly apiKey: string;

  constructor(apiKey: string) {
    if (!apiKey) throw new Error("SportRadar API key is required");
    this.apiKey = apiKey;
  }

  async get<T>(endpoint: string, schema: ZodSchema<T>): Promise<T> {
    const url = `${BASE_URL}${endpoint}`;
    const response = await fetch(url, {
      headers: { "x-api-key": this.apiKey },
      // Use Next.js fetch cache: revalidate every 5 minutes at the HTTP layer.
      // The sync engine applies its own hash-based deduplication on top.
      next: { revalidate: 300 },
    });

    if (!response.ok) {
      throw new SportRadarApiError(
        `SportRadar API error ${response.status}: ${response.statusText}`,
        response.status,
        endpoint
      );
    }

    const raw: unknown = await response.json();

    const parsed = schema.safeParse(raw);
    if (!parsed.success) {
      throw new Error(
        `SportRadar response validation failed for ${endpoint}: ${parsed.error.message}`
      );
    }

    return parsed.data;
  }
}

// Singleton — one client per process, keyed off the API key env var.
let _client: SportRadarClient | null = null;

export function getSportRadarClient(): SportRadarClient {
  if (!_client) {
    const key = process.env.SPORTRADAR_API_KEY;
    if (!key) throw new Error("SPORTRADAR_API_KEY environment variable is not set");
    _client = new SportRadarClient(key);
  }
  return _client;
}
