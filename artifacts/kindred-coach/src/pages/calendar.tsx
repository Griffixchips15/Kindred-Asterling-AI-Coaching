import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@clerk/clerk-react";
import {
  getGetUpcomingCalendarEventsQueryKey,
  useGetUpcomingCalendarEvents,
} from "@workspace/api-client-react";
import { CalendarDays, Clock, AlertCircle } from "lucide-react";

type RawEvent = { date: string; time: string; title: string };

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

function dayHeading(eventDate: Date, today: Date): string {
  const diff = diffInDays(eventDate, today);
  if (diff === 0) return "Today";
  if (diff === 1) return "Tomorrow";
  return eventDate.toLocaleDateString(undefined, {
    weekday: "long",
  });
}

function dateSubtitle(d: Date): string {
  return d.toLocaleDateString(undefined, {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

export default function CalendarPage() {
  const { getToken } = useAuth();
  const [calendarConfigured, setCalendarConfigured] = useState(false);
  const [calendarConnected, setCalendarConnected] = useState(false);
  const [statusLoaded, setStatusLoaded] = useState(false);
  const [statusError, setStatusError] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [connectError, setConnectError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        const token = await getToken();
        const response = await fetch("/api/calendar/status", {
          headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        });
        if (!response.ok)
          throw new Error(`Calendar status failed (${response.status})`);
        const status = (await response.json()) as {
          configured?: boolean;
          connected?: boolean;
        };
        if (!cancelled) {
          setCalendarConfigured(Boolean(status.configured));
          setCalendarConnected(Boolean(status.connected));
          setStatusError(false);
        }
      } catch {
        if (!cancelled) setStatusError(true);
      } finally {
        if (!cancelled) setStatusLoaded(true);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [getToken]);

  const { data, isLoading, isError, refetch, isFetching } =
    useGetUpcomingCalendarEvents({
      query: {
        queryKey: getGetUpcomingCalendarEventsQueryKey(),
        enabled: statusLoaded && calendarConfigured && calendarConnected,
      },
    });

  async function connectCalendar() {
    setConnecting(true);
    setConnectError(null);
    try {
      const token = await getToken();
      const response = await fetch("/api/calendar/connect", {
        headers: {
          Accept: "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });
      const body = (await response.json().catch(() => null)) as {
        authorizationUrl?: string;
        error?: string;
      } | null;
      if (!response.ok || !body?.authorizationUrl) {
        throw new Error(
          body?.error === "calendar_not_configured"
            ? "Google Calendar has not been configured by the site administrator."
            : "Unable to start Google Calendar connection.",
        );
      }
      window.location.assign(body.authorizationUrl);
    } catch (error) {
      setConnectError(
        error instanceof Error
          ? error.message
          : "Unable to start Google Calendar connection.",
      );
      setConnecting(false);
    }
  }

  const grouped = useMemo(() => {
    const today = startOfDay(new Date());
    const events: RawEvent[] = data ?? [];
    const enriched = events
      .map((e) => ({ ...e, _date: parseLocalDate(e.date) }))
      .filter((e) => e._date >= today)
      .sort((a, b) => {
        const cmp = a._date.getTime() - b._date.getTime();
        return cmp !== 0 ? cmp : a.time.localeCompare(b.time);
      });

    const map = new Map<string, { date: Date; events: RawEvent[] }>();
    for (const e of enriched) {
      const bucket = map.get(e.date) ?? { date: e._date, events: [] };
      bucket.events.push({ date: e.date, time: e.time, title: e.title });
      map.set(e.date, bucket);
    }
    return { today, days: Array.from(map.values()) };
  }, [data]);

  const totalEvents = grouped.days.reduce((n, d) => n + d.events.length, 0);

  return (
    <div className="space-y-6 pb-12">
      <header className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-full bg-primary/10 text-primary">
              <CalendarDays className="w-5 h-5" strokeWidth={2} />
            </div>
            <h1 className="text-2xl font-serif text-primary tracking-tight">
              Calendar
            </h1>
          </div>
          <p className="text-sm text-muted-foreground mt-2">
            Your upcoming Google Calendar events, so you can see what your day
            holds before Kindred suggests where to put your energy.
          </p>
        </div>
        <button
          onClick={() => refetch()}
          disabled={isFetching}
          className="text-xs px-3 py-1.5 rounded-md border border-border hover:bg-muted disabled:opacity-50"
          data-testid="calendar-refresh"
        >
          {isFetching ? "Refreshing…" : "Refresh"}
        </button>
      </header>

      {!statusLoaded ? (
        <div className="rounded-lg border border-border bg-card p-10 text-center text-sm text-muted-foreground">
          Checking your calendar connection…
        </div>
      ) : statusError ? (
        <div className="rounded-lg border border-border bg-card p-6 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-muted-foreground shrink-0 mt-0.5" />
          <div className="text-sm">
            <p className="font-medium text-foreground">
              Calendar status unavailable
            </p>
            <p className="text-muted-foreground mt-1">
              Refresh the page after confirming you are signed in.
            </p>
          </div>
        </div>
      ) : !calendarConfigured ? (
        <div className="rounded-lg border border-border bg-card p-6 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-muted-foreground shrink-0 mt-0.5" />
          <div className="text-sm">
            <p className="font-medium text-foreground">
              Google Calendar setup required
            </p>
            <p className="text-muted-foreground mt-1">
              The site administrator still needs to add the Google OAuth
              credentials.
            </p>
          </div>
        </div>
      ) : !calendarConnected ? (
        <div className="rounded-lg border border-border bg-card p-6 flex items-start gap-3">
          <CalendarDays className="w-5 h-5 text-primary shrink-0 mt-0.5" />
          <div className="text-sm">
            <p className="font-medium text-foreground">
              Connect your Google Calendar
            </p>
            <p className="text-muted-foreground mt-1">
              Kindred requests read-only access to your upcoming events.
            </p>
            <button
              type="button"
              onClick={connectCalendar}
              disabled={connecting}
              className="inline-flex mt-4 rounded-md bg-primary px-3 py-2 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              {connecting ? "Connecting…" : "Connect Google Calendar"}
            </button>
            {connectError && (
              <p className="mt-3 text-xs text-destructive">{connectError}</p>
            )}
          </div>
        </div>
      ) : isLoading ? (
        <div className="rounded-lg border border-border bg-card p-10 text-center text-sm text-muted-foreground">
          Loading your calendar…
        </div>
      ) : isError ? (
        <div className="rounded-lg border border-border bg-card p-6 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-muted-foreground shrink-0 mt-0.5" />
          <div className="text-sm">
            <p className="font-medium text-foreground">
              Connect your Google Calendar
            </p>
            <p className="text-muted-foreground mt-1">
              Kindred can use your upcoming events to make planning suggestions.
            </p>
            <button
              onClick={() => refetch()}
              className="mt-4 rounded-md border border-border px-3 py-2 text-xs font-medium hover:bg-muted"
            >
              Try again
            </button>
          </div>
        </div>
      ) : grouped.days.length === 0 ? (
        <div className="rounded-lg border border-border bg-card p-10 text-center">
          <CalendarDays className="w-8 h-8 text-muted-foreground/60 mx-auto mb-3" />
          <p className="text-sm text-foreground">
            Nothing on your calendar right now.
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Enjoy the open space.
          </p>
        </div>
      ) : (
        <>
          <p className="text-xs text-muted-foreground">
            {totalEvents} {totalEvents === 1 ? "event" : "events"} ahead
          </p>
          <div className="space-y-5">
            {grouped.days.map((group) => (
              <section
                key={group.events[0].date}
                className="rounded-lg border border-border bg-card p-5"
              >
                <div className="flex items-baseline justify-between gap-3 mb-3">
                  <h2 className="text-base font-medium">
                    {dayHeading(group.date, grouped.today)}
                  </h2>
                  <span className="text-xs text-muted-foreground">
                    {dateSubtitle(group.date)}
                  </span>
                </div>
                <ul className="space-y-2">
                  {group.events.map((e, i) => (
                    <li
                      key={`${e.date}-${e.time}-${i}`}
                      className="flex items-start gap-3 rounded-md bg-muted/40 px-3 py-2.5"
                      data-testid="calendar-event"
                    >
                      <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground shrink-0 pt-0.5 w-20">
                        <Clock className="w-3.5 h-3.5" strokeWidth={2} />
                        <span className="tabular-nums">{e.time}</span>
                      </div>
                      <p className="text-sm text-foreground leading-snug flex-1">
                        {e.title}
                      </p>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
