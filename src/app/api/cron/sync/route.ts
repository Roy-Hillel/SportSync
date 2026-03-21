// GET /api/cron/sync — called by Vercel Cron on schedule
//
// Protected by a CRON_SECRET bearer token. Vercel sets the
// Authorization header automatically when the cron is configured.

import { NextRequest, NextResponse } from "next/server";
import { runFullSync } from "@/lib/sync/engine";

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  const expected = `Bearer ${process.env.CRON_SECRET}`;

  if (!process.env.CRON_SECRET || authHeader !== expected) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const result = await runFullSync();
  return NextResponse.json(result);
}
