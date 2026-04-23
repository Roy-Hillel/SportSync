// ---------------------------------------------------------------------------
// Deterministic hash of the fields that would change a calendar event.
//
// If the hash hasn't changed since the last fetch, we skip the DB write.
// This is the primary guard against unnecessary downstream writes.
// ---------------------------------------------------------------------------

import { createHash } from "crypto";
import type { ProviderEvent } from "@/lib/providers";

export function hashEvent(event: ProviderEvent): string {
  const payload = [
    event.startTime.toISOString(),
    event.homeTeamName,
    event.awayTeamName,
    event.competitionName,
    event.venue ?? "",
    event.status,
    event.homeScore != null ? String(event.homeScore) : "",
    event.awayScore != null ? String(event.awayScore) : "",
  ].join("|");

  return createHash("md5").update(payload).digest("hex");
}
