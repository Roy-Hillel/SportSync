import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import SettingsForm from "@/components/settings-form";
import { ChevronLeft } from "lucide-react";
import Link from "next/link";

export default async function SettingsPage() {
  const session = await auth();
  if (!session?.user?.email) redirect("/");

  const [user] = await db
    .select({ syncWindowWeeks: users.syncWindowWeeks })
    .from(users)
    .where(eq(users.email, session.user.email))
    .limit(1);

  if (!user) redirect("/");

  return (
    <div className="min-h-screen bg-zinc-50">
      <header className="bg-white border-b border-zinc-200 sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 h-14 flex items-center gap-3">
          <Link
            href="/dashboard"
            className="flex items-center gap-1 text-sm text-zinc-400 hover:text-zinc-700 transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
            Dashboard
          </Link>
          <span className="text-zinc-200">/</span>
          <span className="text-sm font-medium text-zinc-900">Settings</span>
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-4 py-8">
        <SettingsForm
          syncWindowWeeks={user.syncWindowWeeks}
          email={session.user.email}
        />
      </div>
    </div>
  );
}
