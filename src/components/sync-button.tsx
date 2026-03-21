"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw, Check, AlertCircle, Loader2, X, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { SyncResult } from "@/lib/sync/engine";

type State = "idle" | "syncing" | "done" | "error";

export default function SyncButton() {
  const [state, setState] = useState<State>("idle");
  const [result, setResult] = useState<SyncResult | null>(null);
  const [showPanel, setShowPanel] = useState(false);
  const router = useRouter();

  async function sync() {
    setState("syncing");
    setResult(null);
    setShowPanel(false);
    try {
      const res = await fetch("/api/sync", { method: "POST" });
      if (!res.ok) throw new Error();
      const data: SyncResult = await res.json();
      setResult(data);
      setState("done");
      setShowPanel(true);
      router.refresh();
      setTimeout(() => setState("idle"), 8000);
    } catch {
      setState("error");
      setTimeout(() => setState("idle"), 3000);
    }
  }

  return (
    <div className="relative">
      <Button
        variant="outline"
        size="sm"
        onClick={sync}
        disabled={state === "syncing"}
        className={cn(
          "gap-1.5 transition-colors duration-200",
          state === "done" && "border-green-200 text-green-600 bg-green-50 hover:bg-green-50",
          state === "error" && "border-red-200 text-red-600 bg-red-50 hover:bg-red-50"
        )}
      >
        {state === "idle" && <RefreshCw className="w-3.5 h-3.5" />}
        {state === "syncing" && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
        {state === "done" && <Check className="w-3.5 h-3.5" />}
        {state === "error" && <AlertCircle className="w-3.5 h-3.5" />}
        <span className="text-xs">
          {state === "idle" && "Sync"}
          {state === "syncing" && "Syncing…"}
          {state === "done" && "Synced"}
          {state === "error" && "Retry?"}
        </span>
        {result && state === "done" && (
          <button
            onClick={(e) => { e.stopPropagation(); setShowPanel((v) => !v); }}
            className="ml-0.5 text-green-500 hover:text-green-700"
          >
            {showPanel ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          </button>
        )}
      </Button>

      {showPanel && result && (
        <div className="absolute right-0 top-full mt-2 w-72 bg-white border border-zinc-200 rounded-xl shadow-lg z-50 text-xs">
          <div className="flex items-center justify-between px-3 py-2 border-b border-zinc-100">
            <span className="font-medium text-zinc-700">Sync results</span>
            <button onClick={() => setShowPanel(false)} className="text-zinc-400 hover:text-zinc-600">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Summary row */}
          <div className="flex gap-3 px-3 py-2 border-b border-zinc-100 text-zinc-500">
            <span><span className="font-medium text-green-600">{result.eventsCreated}</span> new</span>
            <span><span className="font-medium text-blue-600">{result.eventsUpdated}</span> updated</span>
            <span><span className="font-medium text-zinc-400">{result.eventsUnchanged}</span> unchanged</span>
          </div>

          {/* Per-entity rows */}
          <ul className="divide-y divide-zinc-50 max-h-60 overflow-y-auto">
            {result.entities.map((e, i) => (
              <li key={i} className="px-3 py-2">
                <div className="flex items-start justify-between gap-2">
                  <span className={cn("font-medium truncate", e.error ? "text-red-500" : "text-zinc-700")}>
                    {e.name}
                  </span>
                  {!e.error && (
                    <span className="shrink-0 text-zinc-400">
                      {e.created > 0 && <span className="text-green-600">+{e.created} </span>}
                      {e.updated > 0 && <span className="text-blue-600">~{e.updated} </span>}
                      {e.unchanged > 0 && <span>{e.unchanged} ok</span>}
                    </span>
                  )}
                </div>
                {e.error && (
                  <p className="mt-0.5 text-red-400 text-[11px] leading-tight truncate" title={e.error}>
                    {e.error.length > 60 ? e.error.slice(0, 60) + "…" : e.error}
                  </p>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
