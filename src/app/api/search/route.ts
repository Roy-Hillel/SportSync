// GET /api/search?q=arsenal&type=team
//
// Searches the local subscribable_entities cache. Fast — no provider calls.
// Results are paginated to keep response sizes small.

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { subscribableEntities } from "@/lib/db/schema";
import { ilike, eq, and, or } from "drizzle-orm";
import { z } from "zod";

const QuerySchema = z.object({
  q: z.string().min(1).max(100).optional(),
  type: z.enum(["competition", "team", "nation", "all"]).default("all"),
  parentId: z.string().optional(), // filter teams by competition providerId
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = req.nextUrl;
  const parsed = QuerySchema.safeParse(Object.fromEntries(searchParams));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid query", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { q, type, parentId, limit } = parsed.data;

  const conditions = [];

  if (q) {
    conditions.push(ilike(subscribableEntities.displayName, `%${q}%`));
  }

  if (type !== "all") {
    conditions.push(eq(subscribableEntities.entityType, type));
  }

  if (parentId) {
    conditions.push(eq(subscribableEntities.parentProviderId, parentId));
  }

  const results = await db
    .select({
      id: subscribableEntities.id,
      displayName: subscribableEntities.displayName,
      entityType: subscribableEntities.entityType,
      logoUrl: subscribableEntities.logoUrl,
      country: subscribableEntities.country,
      parentProviderId: subscribableEntities.parentProviderId,
    })
    .from(subscribableEntities)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(subscribableEntities.displayName)
    .limit(limit);

  return NextResponse.json(results);
}
