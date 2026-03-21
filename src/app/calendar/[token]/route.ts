// ---------------------------------------------------------------------------
// GET /calendar/[token]
//
// Returns the iCal feed for the user identified by their calendar token.
// The token is in the URL path rather than a query param so the URL looks
// clean when pasted into a calendar app (e.g. webcal://...).
//
// Cache strategy: short-lived CDN cache (1 hour). The sync engine runs every
// 5 hours so there's little value caching longer, and users should see
// subscription changes within an hour.
// ---------------------------------------------------------------------------

import { NextRequest, NextResponse } from "next/server";
import { generateICalForUser } from "@/lib/ical/generator";

export async function GET(
  _req: NextRequest,
  { params }: { params: { token: string } }
) {
  const { token } = params;

  if (!token || typeof token !== "string") {
    return new NextResponse("Bad Request", { status: 400 });
  }

  const icsContent = await generateICalForUser(token);

  if (icsContent === null) {
    // Token not found — return 404, not 401, to avoid leaking whether tokens
    // exist (timing attacks are not a concern for calendar URLs, but it's tidy).
    return new NextResponse("Not Found", { status: 404 });
  }

  return new NextResponse(icsContent, {
    status: 200,
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": 'attachment; filename="sportsync.ics"',
      // Allow CDN caching for up to 1 hour; stale-while-revalidate for 30 min.
      "Cache-Control": "public, max-age=3600, stale-while-revalidate=1800",
    },
  });
}
