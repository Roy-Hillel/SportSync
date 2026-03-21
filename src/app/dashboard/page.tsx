import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { subscriptions, subscribableEntities, users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import SubscriptionList from "@/components/subscription-list";
import CalendarInstructions from "@/components/calendar-instructions";
import AddSubscriptionModal from "@/components/add-subscription-modal";
import SyncButton from "@/components/sync-button";
import { Settings2 } from "lucide-react";
import Link from "next/link";

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user?.email) redirect("/");

  const [user] = await db
    .select({ id: users.id, calendarToken: users.calendarToken, syncWindowWeeks: users.syncWindowWeeks })
    .from(users)
    .where(eq(users.email, session.user.email))
    .limit(1);

  if (!user) redirect("/");

  const userSubscriptions = await db
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
    .innerJoin(subscribableEntities, eq(subscriptions.entityId, subscribableEntities.id))
    .where(eq(subscriptions.userId, user.id))
    .orderBy(subscriptions.createdAt);

  const baseUrl = process.env.NEXTAUTH_URL ?? "http://localhost:3000";
  const calendarUrl = `${baseUrl}/calendar/${user.calendarToken}`;
  const webcalUrl = calendarUrl.replace(/^https?/, "webcal");

  return (
    <div className="min-h-screen bg-zinc-50">
      {/* Header */}
      <header className="bg-white border-b border-zinc-200 sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 h-14 flex items-center justify-between">
          <span className="text-lg font-bold tracking-tight text-zinc-900">
            Sport<span style={{ color: "var(--accent-brand)" }}>Sync</span>
          </span>
          <div className="flex items-center gap-1">
            <span className="text-xs text-zinc-400 mr-2 hidden sm:block">
              {session.user.email}
            </span>
            <Link
              href="/settings"
              className="p-2 rounded-md text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 transition-colors"
              aria-label="Settings"
            >
              <Settings2 className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-4 py-8 space-y-8">
        {/* Calendar feed */}
        <CalendarInstructions webcalUrl={webcalUrl} httpUrl={calendarUrl} />

        {/* Subscriptions */}
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h2 className="text-xs font-medium tracking-widest text-zinc-400 uppercase">
                Subscriptions
              </h2>
              {userSubscriptions.length > 0 && (
                <span
                  className="text-xs font-medium px-2 py-0.5 rounded-full"
                  style={{
                    background: "var(--accent-brand-light)",
                    color: "var(--accent-brand-text)",
                  }}
                >
                  {userSubscriptions.length}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <SyncButton />
              <AddSubscriptionModal />
            </div>
          </div>
          <SubscriptionList subscriptions={userSubscriptions} />
        </section>
      </div>
    </div>
  );
}
