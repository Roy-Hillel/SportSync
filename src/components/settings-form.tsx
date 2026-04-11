"use client";

import { useState } from "react";
import { signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Separator } from "@/components/ui/separator";
import { Check, AlertTriangle, LogOut, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  syncWindowWeeks: number;
  email: string;
}

const WINDOW_OPTIONS = [
  { value: 4, label: "4 weeks" },
  { value: 8, label: "8 weeks" },
  { value: 16, label: "16 weeks" },
  { value: 26, label: "6 months" },
];

export default function SettingsForm({ syncWindowWeeks, email }: Props) {
  const [weeks, setWeeks] = useState(syncWindowWeeks);
  const [saved, setSaved] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const router = useRouter();

  async function saveWindow(newWeeks: number) {
    setWeeks(newWeeks);
    await fetch("/api/user", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ syncWindowWeeks: newWeeks }),
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  async function resetToken() {
    if (!confirm("Reset your calendar URL? Your current subscriptions in other apps will stop working.")) return;
    await fetch("/api/user", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ resetCalendarToken: true }),
    });
    router.refresh();
  }

  async function deleteAccount() {
    if (!confirm("Delete your account and all subscriptions? This cannot be undone.")) return;
    setDeleting(true);
    await fetch("/api/user", { method: "DELETE" });
    await signOut({ callbackUrl: "/" });
  }

  return (
    <div className="space-y-5">

      {/* Sync window */}
      <div className="bg-white rounded-xl border border-zinc-200 p-5 space-y-4">
        <div>
          <h2 className="text-xs font-medium tracking-widest text-zinc-400 uppercase mb-1">
            Sync Window
          </h2>
          <p className="text-sm text-zinc-500">How far ahead to include matches in your feed.</p>
        </div>

        {/* Segmented control */}
        <div className="inline-flex rounded-lg border border-zinc-200 bg-zinc-100 p-1 gap-0.5">
          {WINDOW_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => saveWindow(opt.value)}
              className={cn(
                "px-4 py-1.5 text-sm rounded-md transition-colors duration-150 font-medium cursor-pointer",
                weeks === opt.value
                  ? "bg-white shadow-sm text-zinc-900"
                  : "text-zinc-500 hover:text-zinc-700"
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {saved && (
          <div className="flex items-center gap-1.5 text-xs text-green-600">
            <Check className="w-3.5 h-3.5" />
            Saved
          </div>
        )}
      </div>

      {/* Account */}
      <div className="bg-white rounded-xl border border-zinc-200 p-5 space-y-4">
        <h2 className="text-xs font-medium tracking-widest text-zinc-400 uppercase">Account</h2>
        <p className="text-sm text-zinc-600">{email}</p>

        <Separator />

        <div className="flex flex-col gap-3">
          <button
            onClick={resetToken}
            className="flex items-center gap-2 text-sm text-amber-600 hover:text-amber-800 transition-colors text-left cursor-pointer"
          >
            <AlertTriangle className="w-4 h-4 shrink-0" />
            Reset calendar URL
          </button>
          <button
            onClick={() => signOut({ callbackUrl: "/" })}
            className="flex items-center gap-2 text-sm text-zinc-500 hover:text-zinc-800 transition-colors text-left"
          >
            <LogOut className="w-4 h-4 shrink-0" />
            Sign out
          </button>
          <button
            onClick={deleteAccount}
            disabled={deleting}
            className="flex items-center gap-2 text-sm text-red-500 hover:text-red-700 disabled:opacity-40 transition-colors text-left"
          >
            <Trash2 className="w-4 h-4 shrink-0" />
            {deleting ? "Deleting…" : "Delete account"}
          </button>
        </div>
      </div>
    </div>
  );
}
