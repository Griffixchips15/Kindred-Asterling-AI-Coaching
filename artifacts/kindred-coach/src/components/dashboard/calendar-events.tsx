import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { CalendarDays, Clock } from "lucide-react";

export type CalendarEvent = {
  date: string;
  time: string;
  title: string;
};

const DEFAULT_EVENTS: CalendarEvent[] = [
  { date: "2026-05-27", time: "12:20 PM", title: "Phone appointment with Freddy" },
  { date: "2026-05-28", time: "10:00 AM", title: "Kindred Coach dev session" },
  { date: "2026-05-30", time: "3:00 PM", title: "Review weekly goals" },
];

const DAYS_AHEAD = 3;

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function parseLocalDate(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}

function diffInDays(a: Date, b: Date): number {
  return Math.round((startOfDay(a).getTime() - startOfDay(b).getTime()) / 86_400_000);
}

function formatDayLabel(eventDate: Date, today: Date): string {
  const diff = diffInDays(eventDate, today);
  if (diff === 0) return "Today";
  if (diff === 1) return "Tomorrow";
  return eventDate.toLocaleDateString(undefined, { weekday: "long" });
}

function formatDateSubtitle(d: Date): string {
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function CalendarEvents({
  events = DEFAULT_EVENTS,
}: {
  events?: CalendarEvent[];
}) {
  const grouped = useMemo(() => {
    const today = startOfDay(new Date());
    const cutoff = new Date(today);
    cutoff.setDate(cutoff.getDate() + DAYS_AHEAD);

    const upcoming = events
      .map((e) => ({ ...e, _date: parseLocalDate(e.date) }))
      .filter((e) => e._date >= today && e._date <= cutoff)
      .sort((a, b) => {
        const cmp = a._date.getTime() - b._date.getTime();
        return cmp !== 0 ? cmp : a.time.localeCompare(b.time);
      });

    const map = new Map<string, { date: Date; events: CalendarEvent[] }>();
    for (const e of upcoming) {
      const key = e.date;
      const bucket = map.get(key) ?? { date: e._date, events: [] };
      bucket.events.push({ date: e.date, time: e.time, title: e.title });
      map.set(key, bucket);
    }
    return { today, days: Array.from(map.values()) };
  }, [events]);

  return (
    <Card className="border-none shadow-sm bg-card">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-full bg-primary/10 text-primary shrink-0">
            <CalendarDays className="w-5 h-5" strokeWidth={2} />
          </div>
          <div className="flex-1 min-w-0">
            <CardTitle className="font-serif text-xl">Upcoming</CardTitle>
            <CardDescription>Today and the next {DAYS_AHEAD} days</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        {grouped.days.length === 0 ? (
          <p className="text-sm text-muted-foreground py-6 text-center">
            Nothing on your calendar — enjoy the open space.
          </p>
        ) : (
          <div className="space-y-5">
            {grouped.days.map((group) => (
              <div key={group.events[0].date} className="space-y-2">
                <div className="flex items-baseline gap-2">
                  <h3 className="text-sm font-medium text-foreground">
                    {formatDayLabel(group.date, grouped.today)}
                  </h3>
                  <span className="text-xs text-muted-foreground">
                    {formatDateSubtitle(group.date)}
                  </span>
                </div>
                <ul className="space-y-1.5">
                  {group.events.map((event, i) => (
                    <li
                      key={`${event.date}-${event.time}-${i}`}
                      className="flex items-start gap-3 rounded-lg bg-muted/40 px-3 py-2.5"
                      data-testid="calendar-event"
                    >
                      <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground shrink-0 pt-0.5 w-20">
                        <Clock className="w-3.5 h-3.5" strokeWidth={2} />
                        <span className="tabular-nums">{event.time}</span>
                      </div>
                      <p className="text-sm text-foreground leading-snug flex-1">
                        {event.title}
                      </p>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
