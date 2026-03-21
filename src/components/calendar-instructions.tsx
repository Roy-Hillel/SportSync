"use client";

import { useState } from "react";
import { Copy, Check, Calendar, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
  webcalUrl: string;
  httpUrl: string;
}

export default function CalendarInstructions({ webcalUrl, httpUrl }: Props) {
  const [copied, setCopied] = useState(false);

  function copy() {
    navigator.clipboard.writeText(httpUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="bg-white rounded-xl border border-zinc-200 p-5 space-y-4">
      <div>
        <h2 className="text-xs font-medium tracking-widest text-zinc-400 uppercase mb-1">
          Your Calendar Feed
        </h2>
        <p className="text-sm text-zinc-500">
          Subscribe to this URL in any calendar app.
        </p>
      </div>

      {/* URL row */}
      <div className="flex gap-2">
        <input
          readOnly
          value={httpUrl}
          className="flex-1 text-xs font-mono bg-zinc-50 ring-1 ring-zinc-200 rounded-lg px-3 py-2 text-zinc-600 overflow-hidden text-ellipsis focus:outline-none"
        />
        <Button
          variant="outline"
          size="sm"
          onClick={copy}
          className="shrink-0 gap-1.5"
        >
          {copied ? (
            <Check className="w-3.5 h-3.5 text-green-600" />
          ) : (
            <Copy className="w-3.5 h-3.5" />
          )}
          <span className="text-xs">{copied ? "Copied" : "Copy"}</span>
        </Button>
      </div>

      {/* Quick-add links */}
      <div className="flex flex-wrap gap-2">
        <a
          href={webcalUrl}
          className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border border-zinc-200 text-zinc-600 hover:border-[var(--accent-brand)] hover:text-[var(--accent-brand)] transition-colors"
        >
          <Calendar className="w-3 h-3" />
          Apple / Outlook
        </a>
        <a
          href={`https://calendar.google.com/calendar/r?cid=${encodeURIComponent(httpUrl)}`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border border-zinc-200 text-zinc-600 hover:border-[var(--accent-brand)] hover:text-[var(--accent-brand)] transition-colors"
        >
          <Calendar className="w-3 h-3" />
          Google Calendar
        </a>
      </div>

      <div className="flex items-center gap-1.5 text-xs text-zinc-400">
        <Lock className="w-3 h-3" />
        Keep this URL private — anyone with it can see your subscriptions.
      </div>
    </div>
  );
}
