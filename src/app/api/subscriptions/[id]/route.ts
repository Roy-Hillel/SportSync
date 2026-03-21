// DELETE /api/subscriptions/[id]

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { subscriptions, users } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
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

  // Delete only if the subscription belongs to this user — prevents
  // one user from deleting another's subscriptions.
  const [deleted] = await db
    .delete(subscriptions)
    .where(
      and(
        eq(subscriptions.id, params.id),
        eq(subscriptions.userId, user.id)
      )
    )
    .returning({ id: subscriptions.id });

  if (!deleted) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return new NextResponse(null, { status: 204 });
}
