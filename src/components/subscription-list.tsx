"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { CalendarX2 } from "lucide-react";

interface Subscription {
  id: string;
  entity: {
    id: string;
    displayName: string;
    entityType: string;
    logoUrl: string | null;
    country: string | null;
  };
}

const ENTITY_LABEL: Record<string, string> = {
  competition: "League",
  team: "Team",
  nation: "Nation",
};

export default function SubscriptionList({ subscriptions }: { subscriptions: Subscription[] }) {
  const router = useRouter();
  const [removing, setRemoving] = useState<string | null>(null);

  if (subscriptions.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-zinc-200 py-14 flex flex-col items-center gap-3 text-center">
        <CalendarX2 className="w-9 h-9 text-zinc-300" strokeWidth={1.5} />
        <div>
          <p className="text-sm text-zinc-500 font-medium">No subscriptions yet</p>
          <p className="text-xs text-zinc-400 mt-0.5">Click &ldquo;Add&rdquo; to follow a league or team.</p>
        </div>
      </div>
    );
  }

  async function remove(id: string) {
    setRemoving(id);
    try {
      await fetch(`/api/subscriptions/${id}`, { method: "DELETE" });
      router.refresh();
    } finally {
      setRemoving(null);
    }
  }

  return (
    <ul className="bg-white rounded-xl border border-zinc-200 overflow-hidden divide-y divide-zinc-100">
      {subscriptions.map((sub) => (
        <li
          key={sub.id}
          className="flex items-center gap-3 px-4 py-3 hover:bg-zinc-50 transition-colors"
        >
          {/* Logo or fallback */}
          {sub.entity.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={sub.entity.logoUrl}
              alt=""
              className="w-9 h-9 rounded-lg object-contain bg-zinc-100"
            />
          ) : (
            <div
              className="w-9 h-9 rounded-lg flex items-center justify-center text-sm font-semibold shrink-0"
              style={{
                background: "var(--accent-brand-light)",
                color: "var(--accent-brand)",
              }}
            >
              {sub.entity.displayName.charAt(0).toUpperCase()}
            </div>
          )}

          {/* Name + meta */}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-zinc-900 truncate">
              {sub.entity.displayName}
            </p>
            <div className="flex items-center gap-1.5 mt-0.5">
              <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4 font-medium">
                {ENTITY_LABEL[sub.entity.entityType] ?? sub.entity.entityType}
              </Badge>
              {sub.entity.country && (
                <span className="text-xs text-zinc-400">{sub.entity.country}</span>
              )}
            </div>
          </div>

          {/* Remove */}
          <button
            onClick={() => remove(sub.id)}
            disabled={removing === sub.id}
            className="text-xs text-zinc-400 hover:text-red-500 disabled:opacity-40 transition-colors shrink-0 cursor-pointer"
          >
            {removing === sub.id ? "Removing…" : "Remove"}
          </button>
        </li>
      ))}
    </ul>
  );
}
