import { CalendarDays, MapPin } from "lucide-react";

interface Match {
  id: string;
  homeTeamName: string;
  awayTeamName: string;
  competitionName: string;
  startTime: Date;
  venue: string | null;
}

interface Props {
  matches: Match[];
}

function formatMatchDate(date: Date): string {
  return date.toLocaleDateString("en-GB", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

function formatMatchTime(date: Date): string {
  return date.toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function groupByDate(matches: Match[]): Map<string, Match[]> {
  const groups = new Map<string, Match[]>();
  for (const match of matches) {
    const key = match.startTime.toDateString();
    const existing = groups.get(key);
    if (existing) {
      existing.push(match);
    } else {
      groups.set(key, [match]);
    }
  }
  return groups;
}

export default function UpcomingMatches({ matches }: Props) {
  if (matches.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-zinc-200 py-14 flex flex-col items-center gap-3 text-center">
        <CalendarDays className="w-9 h-9 text-zinc-300" strokeWidth={1.5} />
        <div>
          <p className="text-sm text-zinc-500 font-medium">No upcoming matches</p>
          <p className="text-xs text-zinc-400 mt-0.5">
            Add subscriptions and run a sync to see matches here.
          </p>
        </div>
      </div>
    );
  }

  const groups = groupByDate(matches);

  return (
    <div className="space-y-4">
      {Array.from(groups.entries()).map(([dateKey, dayMatches]) => (
        <div key={dateKey}>
          <p className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider mb-2 px-1">
            {formatMatchDate(dayMatches[0].startTime)}
          </p>
          <ul className="bg-white rounded-xl border border-zinc-200 overflow-hidden divide-y divide-zinc-100">
            {dayMatches.map((match) => (
              <li key={match.id} className="px-4 py-3 hover:bg-zinc-50 transition-colors">
                {/* Teams */}
                <p className="text-sm font-medium text-zinc-900">
                  {match.homeTeamName}{" "}
                  <span className="text-zinc-400 font-normal">vs</span>{" "}
                  {match.awayTeamName}
                </p>

                {/* Meta row */}
                <div className="flex items-center gap-3 mt-1 flex-wrap">
                  <span
                    className="text-[11px] font-medium"
                    style={{ color: "var(--accent-brand)" }}
                  >
                    {match.competitionName}
                  </span>
                  <span className="text-[11px] text-zinc-400">
                    {formatMatchTime(match.startTime)}
                  </span>
                  {match.venue && (
                    <span className="flex items-center gap-1 text-[11px] text-zinc-400">
                      <MapPin className="w-3 h-3 shrink-0" />
                      {match.venue}
                    </span>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
