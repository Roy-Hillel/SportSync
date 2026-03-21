import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import SignInButton from "@/components/sign-in-button";
import { CalendarCheck, CheckCircle2 } from "lucide-react";

export default async function LandingPage() {
  const session = await auth();
  if (session?.user) redirect("/dashboard");

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-8 bg-zinc-50">
      <div className="max-w-sm w-full text-center space-y-10">

        {/* Wordmark */}
        <div className="space-y-4">
          <div className="flex items-center justify-center gap-2.5">
            <CalendarCheck className="w-9 h-9" style={{ color: "var(--accent-brand)" }} strokeWidth={1.75} />
            <h1 className="text-4xl font-bold tracking-tight text-zinc-900">
              Sport<span style={{ color: "var(--accent-brand)" }}>Sync</span>
            </h1>
          </div>
          <p className="text-base text-zinc-500 leading-relaxed">
            Follow your teams and leagues.<br />Every match, automatically in your calendar.
          </p>
        </div>

        {/* Features */}
        <div className="space-y-3 text-left">
          {[
            "Follow any league, team, or national side",
            "One URL — works with Google, Apple, Outlook",
            "Reschedules and cancellations sync automatically",
          ].map((feature) => (
            <div key={feature} className="flex items-start gap-3">
              <CheckCircle2
                className="w-4 h-4 mt-0.5 shrink-0"
                style={{ color: "var(--accent-brand)" }}
              />
              <span className="text-sm text-zinc-600">{feature}</span>
            </div>
          ))}
        </div>

        {/* CTA */}
        <SignInButton />
      </div>
    </main>
  );
}
