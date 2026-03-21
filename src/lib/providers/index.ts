// ---------------------------------------------------------------------------
// Provider registry
//
// The app resolves the active SportsDataProvider through this module.
// To add a new provider: implement SportsDataProvider, import it here,
// register it in the map, and set SPORTS_PROVIDER=yourname in .env.
// ---------------------------------------------------------------------------

import type { SportsDataProvider } from "./types";
import { getSportRadarProvider } from "./sportradar";

export type { SportsDataProvider, ProviderEntity, ProviderEvent, EntityType, EventStatus } from "./types";

const PROVIDERS: Record<string, () => SportsDataProvider> = {
  sportradar: getSportRadarProvider,
};

export function getActiveProvider(): SportsDataProvider {
  const name = process.env.SPORTS_PROVIDER ?? "sportradar";
  const factory = PROVIDERS[name];
  if (!factory) {
    throw new Error(
      `Unknown SPORTS_PROVIDER "${name}". Available: ${Object.keys(PROVIDERS).join(", ")}`
    );
  }
  return factory();
}
