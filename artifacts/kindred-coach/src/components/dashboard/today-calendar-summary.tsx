import { useMemo } from "react";
import { Link } from "wouter";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { CalendarDays } from "lucide-react";
import { useGetUpcomingCalendarEvents } from "@workspace/api-client-react";

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
  return Math.round(
    (startOfDay(a).getTime() - startOfDay(b).getTime()) / 86_400_000,
  );
}

function dayLabel(eventDate: Date, today: Date): string {
  const diff = diffInDays(eventDate, today);
  if (diff === 0) return "Today";
  if (diff === 1) return "Tomorrow";
  return eventDate.toLocaleDateString(undefined, { weekday: "long" });
}

/**
 * Privacy-preserving calendar summary for the Today page: only the *count* of
 * upcoming events, the days they fall on, and the earliest/latest timing
 * window are shown. Event titles are never rendered on Today — the full
 * calendar page remains the single place titles are surfaced.
 */
export function TodayCalendarSummary() {
  const { data, isLoading, isError } = useGetUpcomingCalendarEvents();
  const events = useMemo(() => data ?? [], [data]);

  const meta = useMemo(() => {
    if (events.length === 0) {
      return {
        count: 0,
        dayLabels: [] as string[],
        earliest: null as string | null,
        latest: null as string | null,
      };
    }

    const today = startOfDay(new Date());
    const cutoff = new Date(today);
    cutoff.setDate(cutoff.getDate() + DAYS_AHEAD);

    const upcoming = events
      .map((e) => ({ ...e, _date: parseLocalDate(e.date) }))
      .filter((e) => e._date >= today && e._date <= cutoff)
      // Chronological by date first, then time within a day, so the represented
      // day labels read in calendar order.
      .sort((a, b) => {
        const byDate = a._date.getTime() - b._date.getTime();
        return byDate !== 0 ? byDate : a.time.localeCompare(b.time);
      });

    const dayLabels = Array.from(
      new Set(upcoming.map((e) => dayLabel(e._date, today))),
    );

    // Earliest/latest clock times are computed across every event, independent
    // of the list ordering, so the window is always the true span.
    let earliest: string | null = null;
    let latest: string | null = null;
    for (const e of upcoming) {
      if (earliest === null || e.time < earliest) earliest = e.time;
      if (latest === null || e.time > latest) latest = e.time;
    }

    return {
      count: upcoming.length,
      dayLabels,
      earliest,
      latest,
    };
  }, [events]);

  return (
    <Card className="border-none shadow-sm bg-card">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-full bg-primary/10 text-primary shrink-0">
            <CalendarDays className="w-5 h-5" strokeWidth={2} />
          </div>
          <div className="flex-1 min-w-0">
            <CardTitle className="font-serif text-xl">Today's calendar</CardTitle>
            <CardDescription>Just the shape of your next {DAYS_AHEAD} days</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        {isLoading ? (
          <p className="text-sm text-muted-foreground py-6 text-center">
            Loading your calendar…
          </p>
        ) : isError ? (
          <p
            className="text-sm text-muted-foreground py-6 text-center"
            data-testid="calendar-summary-unavailable"
          >
            Calendar isn't available right now.
          </p>
        ) : meta.count === 0 ? (
          <p
            className="text-sm text-muted-foreground py-6 text-center"
            data-testid="calendar-summary-empty"
          >
            No events in the next {DAYS_AHEAD} days.
          </p>
        ) : (
          <div
            className="space-y-2 text-sm"
            data-testid="calendar-summary-loaded"
          >
            <p className="flex items-center justify-between gap-3">
              <span className="text-muted-foreground">Events</span>
              <span className="font-medium text-foreground">{meta.count}</span>
            </p>
            {meta.dayLabels.length > 0 && (
              <p className="flex items-center justify-between gap-3">
                <span className="text-muted-foreground">When</span>
                <span className="font-medium text-foreground">
                  {meta.dayLabels.join(", ")}
                </span>
              </p>
            )}
            {meta.earliest && meta.latest && (
              <p className="flex items-center justify-between gap-3">
                <span className="text-muted-foreground">Timing</span>
                <span className="font-medium text-foreground tabular-nums">
                  {meta.earliest} – {meta.latest}
                </span>
              </p>
            )}
            <Link
              href="/calendar"
              className="inline-block pt-1 text-xs font-medium text-primary underline underline-offset-2 hover:text-primary/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded-sm"
              data-testid="calendar-summary-link"
            >
              Open your calendar
            </Link>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
