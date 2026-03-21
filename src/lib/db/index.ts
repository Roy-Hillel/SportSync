import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

declare global {
  // eslint-disable-next-line no-var
  var _pgClient: postgres.Sql | undefined;
}

// Parse the DATABASE_URL and pass connection params explicitly.
// Passing ssl options alongside a URL string causes conflicts in the postgres
// driver — splitting them out ensures SSL is applied correctly.
function createClient() {
  const url = new URL(process.env.DATABASE_URL!);
  return postgres({
    host: url.hostname,
    port: Number(url.port) || 5432,
    database: url.pathname.slice(1),
    username: url.username,
    password: decodeURIComponent(url.password),
    ssl: { rejectUnauthorized: false },
    max: 10,
    idle_timeout: 20,
  });
}

// Lazy singleton — deferred until first access so that scripts calling
// dotenv.config() before importing this module see the env vars in time.
let _db: ReturnType<typeof drizzle<typeof schema>> | undefined;

export function getDb() {
  if (!_db) {
    const client = global._pgClient ?? createClient();
    if (process.env.NODE_ENV !== "production") {
      global._pgClient = client;
    }
    _db = drizzle(client, { schema });
  }
  return _db;
}

// Convenience proxy so existing `import { db }` callers keep working without
// change — property accesses are forwarded to the lazily-created instance.
export const db = new Proxy({} as ReturnType<typeof drizzle<typeof schema>>, {
  get(_target, prop) {
    return (getDb() as Record<string | symbol, unknown>)[prop];
  },
});
export type DB = typeof db;
