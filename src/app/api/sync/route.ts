// POST /api/sync — manual sync trigger (authenticated users only)

import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { runFullSync } from "@/lib/sync/engine";

export async function POST() {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await runFullSync();
  return NextResponse.json(result);
}
