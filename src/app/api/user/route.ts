// GET  /api/user — current user profile
// PATCH /api/user — update sync_window_weeks
// DELETE /api/user — delete account and all data

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { randomBytes } from "crypto";

const PatchUserSchema = z.object({
  syncWindowWeeks: z.number().int().min(1).max(52).optional(),
  resetCalendarToken: z.boolean().optional(),
});

export async function GET() {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [user] = await db
    .select({
      id: users.id,
      email: users.email,
      name: users.name,
      calendarToken: users.calendarToken,
      syncWindowWeeks: users.syncWindowWeeks,
      createdAt: users.createdAt,
    })
    .from(users)
    .where(eq(users.email, session.user.email))
    .limit(1);

  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

  return NextResponse.json(user);
}

export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body: unknown = await req.json();
  const parsed = PatchUserSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const updates: Partial<typeof users.$inferInsert> = {};
  if (parsed.data.syncWindowWeeks !== undefined) {
    updates.syncWindowWeeks = parsed.data.syncWindowWeeks;
  }
  if (parsed.data.resetCalendarToken) {
    updates.calendarToken = randomBytes(32).toString("hex");
  }

  const [updated] = await db
    .update(users)
    .set(updates)
    .where(eq(users.email, session.user.email))
    .returning({
      calendarToken: users.calendarToken,
      syncWindowWeeks: users.syncWindowWeeks,
    });

  return NextResponse.json(updated);
}

export async function DELETE() {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Cascade deletes subscriptions automatically (FK ON DELETE CASCADE).
  await db.delete(users).where(eq(users.email, session.user.email));

  return new NextResponse(null, { status: 204 });
}
