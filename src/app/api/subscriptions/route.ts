// GET  /api/subscriptions  — list user's subscriptions
// POST /api/subscriptions  — add a subscription

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { subscriptions, subscribableEntities, users } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { z } from "zod";

const CreateSubscriptionSchema = z.object({
  entityId: z.string().uuid(),
});

export async function GET() {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [user] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, session.user.email))
    .limit(1);

  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const rows = await db
    .select({
      id: subscriptions.id,
      createdAt: subscriptions.createdAt,
      entity: {
        id: subscribableEntities.id,
        displayName: subscribableEntities.displayName,
        entityType: subscribableEntities.entityType,
        logoUrl: subscribableEntities.logoUrl,
        country: subscribableEntities.country,
      },
    })
    .from(subscriptions)
    .innerJoin(
      subscribableEntities,
      eq(subscriptions.entityId, subscribableEntities.id)
    )
    .where(eq(subscriptions.userId, user.id))
    .orderBy(subscriptions.createdAt);

  return NextResponse.json(rows);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body: unknown = await req.json();
  const parsed = CreateSubscriptionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const [user] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, session.user.email))
    .limit(1);

  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

  // Verify the entity exists.
  const [entity] = await db
    .select({ id: subscribableEntities.id })
    .from(subscribableEntities)
    .where(eq(subscribableEntities.id, parsed.data.entityId))
    .limit(1);

  if (!entity) {
    return NextResponse.json({ error: "Entity not found" }, { status: 404 });
  }

  // Insert, ignoring duplicate (idempotent).
  const [created] = await db
    .insert(subscriptions)
    .values({ userId: user.id, entityId: entity.id })
    .onConflictDoNothing()
    .returning({ id: subscriptions.id });

  // created will be undefined if it was a duplicate — return 200 either way.
  return NextResponse.json({ id: created?.id ?? null }, { status: 201 });
}
