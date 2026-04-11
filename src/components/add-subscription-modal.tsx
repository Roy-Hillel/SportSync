"use client";

import { useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { Plus, Search, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

interface Entity {
  id: string;
  displayName: string;
  entityType: string;
  logoUrl: string | null;
  country: string | null;
}

type FilterType = "all" | "competition" | "team" | "nation";

const FILTERS: { value: FilterType; label: string }[] = [
  { value: "all", label: "All" },
  { value: "competition", label: "Leagues" },
  { value: "team", label: "Teams" },
  { value: "nation", label: "Nations" },
];

export default function AddSubscriptionModal() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<FilterType>("all");
  const [results, setResults] = useState<Entity[]>([]);
  const [loading, setLoading] = useState(false);
  const [adding, setAdding] = useState<string | null>(null);
  const router = useRouter();
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const search = useCallback((q: string, type: FilterType) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams({ type });
        if (q) params.set("q", q);
        const res = await fetch(`/api/search?${params}`);
        setResults(await res.json());
      } finally {
        setLoading(false);
      }
    }, 300);
  }, []);

  function handleOpen(isOpen: boolean) {
    setOpen(isOpen);
    if (isOpen) {
      setQuery("");
      setFilter("all");
      search("", "all");
    }
  }

  async function add(entityId: string) {
    setAdding(entityId);
    try {
      await fetch("/api/subscriptions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entityId }),
      });
      router.refresh();
      setOpen(false);
    } finally {
      setAdding(null);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="gap-1.5" style={{ background: "var(--accent-brand)" }}>
          <Plus className="w-3.5 h-3.5" />
          <span className="text-xs">Add</span>
        </Button>
      </DialogTrigger>

      <DialogContent className="max-w-md p-0 gap-0 overflow-hidden">
        <DialogHeader className="px-5 pt-5 pb-4 border-b border-zinc-100">
          <DialogTitle className="text-base font-semibold">Follow a team or league</DialogTitle>
        </DialogHeader>

        {/* Search + filters */}
        <div className="px-5 pt-4 pb-3 space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400 pointer-events-none" />
            <Input
              autoFocus
              placeholder="Search leagues, teams…"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                search(e.target.value, filter);
              }}
              className="pl-9"
            />
          </div>

          <div className="flex gap-1.5">
            {FILTERS.map((f) => (
              <button
                key={f.value}
                onClick={() => {
                  setFilter(f.value);
                  search(query, f.value);
                }}
                className={cn(
                  "px-3 py-1 text-xs rounded-full border transition-colors duration-150 font-medium cursor-pointer",
                  filter === f.value
                    ? "border-[var(--accent-brand)] text-[var(--accent-brand)] bg-[var(--accent-brand-light)]"
                    : "border-zinc-200 text-zinc-500 hover:border-zinc-400"
                )}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {/* Results */}
        <div className="max-h-72 overflow-y-auto px-5 pb-5">
          {loading && (
            <div className="space-y-3 py-2">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex items-center gap-3 animate-pulse">
                  <div className="w-9 h-9 rounded-lg bg-zinc-100 shrink-0" />
                  <div className="flex-1 space-y-1.5">
                    <div className="h-3 bg-zinc-100 rounded w-2/3" />
                    <div className="h-2.5 bg-zinc-100 rounded w-1/3" />
                  </div>
                </div>
              ))}
            </div>
          )}

          {!loading && results.length === 0 && (
            <p className="text-sm text-zinc-400 text-center py-8">
              {query ? "No results found." : "Start typing to search."}
            </p>
          )}

          {!loading && results.length > 0 && (
            <ul className="divide-y divide-zinc-100">
              {results.map((entity) => (
                <li key={entity.id} className="flex items-center gap-3 py-3">
                  {entity.logoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={entity.logoUrl} alt="" className="w-9 h-9 rounded-lg object-contain bg-zinc-100 shrink-0" />
                  ) : (
                    <div
                      className="w-9 h-9 rounded-lg flex items-center justify-center text-sm font-semibold shrink-0"
                      style={{ background: "var(--accent-brand-light)", color: "var(--accent-brand)" }}
                    >
                      {entity.displayName.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-zinc-900 truncate">{entity.displayName}</p>
                    <p className="text-xs text-zinc-400">
                      {entity.entityType}{entity.country && ` · ${entity.country}`}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    className="shrink-0 h-7 text-xs px-3"
                    style={{ background: "var(--accent-brand)" }}
                    onClick={() => add(entity.id)}
                    disabled={adding === entity.id}
                  >
                    {adding === entity.id ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : (
                      "Add"
                    )}
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
