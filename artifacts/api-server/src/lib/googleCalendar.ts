// Wraps the Replit Google Calendar connector (see google-calendar blueprint).
// Tokens, identity, and refresh are handled by the SDK.
import { ReplitConnectors } from "@replit/connectors-sdk";

type GoogleEventDateTime = {
  date?: string;
  dateTime?: string;
  timeZone?: string;
};

type GoogleEvent = {
  id: string;
  summary?: string;
  status?: string;
  start?: GoogleEventDateTime;
  end?: GoogleEventDateTime;
};

type GoogleEventsResponse = {
  items?: GoogleEvent[];
};

export type NormalizedCalendarEvent = {
  date: string;
  time: string;
  title: string;
};

const connectors = new ReplitConnectors();

function formatLocalDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function formatLocalTime(d: Date): string {
  return d.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

export async function fetchUpcomingEvents(daysAhead: number): Promise<NormalizedCalendarEvent[]> {
  const now = new Date();
  const end = new Date(now);
  end.setDate(end.getDate() + daysAhead + 1);
  end.setHours(0, 0, 0, 0);

  const params = new URLSearchParams({
    timeMin: now.toISOString(),
    timeMax: end.toISOString(),
    singleEvents: "true",
    orderBy: "startTime",
    maxResults: "50",
  });

  const response = await connectors.proxy(
    "google-calendar",
    `/calendar/v3/calendars/primary/events?${params.toString()}`,
    { method: "GET" },
  );

  if (!response.ok) {
    throw new Error(`Google Calendar API returned ${response.status}`);
  }

  const body = (await response.json()) as GoogleEventsResponse;
  const items = body.items ?? [];

  return items
    .filter((e) => e.status !== "cancelled" && (e.start?.dateTime || e.start?.date))
    .map<NormalizedCalendarEvent>((e) => {
      if (e.start?.dateTime) {
        const d = new Date(e.start.dateTime);
        return {
          date: formatLocalDate(d),
          time: formatLocalTime(d),
          title: e.summary?.trim() || "(no title)",
        };
      }
      return {
        date: e.start!.date!,
        time: "All day",
        title: e.summary?.trim() || "(no title)",
      };
    });
}
