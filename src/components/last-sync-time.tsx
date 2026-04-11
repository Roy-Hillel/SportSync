import { Clock } from "lucide-react";

interface Props {
  lastSyncedAt: Date | null;
}

function formatRelativeTime(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMinutes = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffMinutes < 1) return "just now";
  if (diffMinutes < 60) return `${diffMinutes} minute${diffMinutes === 1 ? "" : "s"} ago`;
  if (diffHours < 24) return `${diffHours} hour${diffHours === 1 ? "" : "s"} ago`;
  if (diffDays < 7) return `${diffDays} day${diffDays === 1 ? "" : "s"} ago`;

  return date.toLocaleDateString("en-GB", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function LastSyncTime({ lastSyncedAt }: Props) {
  const label = lastSyncedAt
    ? `Last synced ${formatRelativeTime(lastSyncedAt)}`
    : "Never synced";

  return (
    <div className="flex items-center gap-1.5 text-xs text-zinc-400">
      <Clock className="w-3.5 h-3.5 shrink-0" />
      <span>{label}</span>
    </div>
  );
}
