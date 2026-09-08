import { useState } from "react";
import { useAuth } from "@clerk/clerk-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getGetUpcomingCalendarEventsQueryKey } from "@workspace/api-client-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";

const STATUS_KEY = ["calendar-retirement-status"];

/** Preserve old bookmarks and consent withdrawal without fetching any events. */
export default function CalendarPage() {
  const { getToken } = useAuth();
  const queryClient = useQueryClient();
  const [disconnecting, setDisconnecting] = useState(false);
  const [message, setMessage] = useState("");
  const status = useQuery({
    queryKey: STATUS_KEY,
    retry: false,
    queryFn: async ({ signal }) => {
      const token = await getToken();
      const response = await fetch("/api/calendar/status", {
        signal,
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });
      if (!response.ok) throw new Error("Calendar status unavailable");
      const data = (await response.json()) as { connected?: boolean };
      if (typeof data.connected !== "boolean")
        throw new Error("Invalid calendar status");
      return { connected: data.connected };
    },
  });

  async function disconnect() {
    setDisconnecting(true);
    setMessage("");
    try {
      const token = await getToken();
      const response = await fetch("/api/calendar/connection", {
        method: "DELETE",
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });
      if (!response.ok) throw new Error("Calendar disconnect failed");
      queryClient.setQueryData(STATUS_KEY, { connected: false });
      queryClient.removeQueries({
        queryKey: getGetUpcomingCalendarEventsQueryKey(),
      });
      setMessage(
        "Your saved calendar connection has been removed from Kindred.",
      );
    } catch {
      setMessage(
        "We could not remove your saved connection. Please try again.",
      );
    } finally {
      setDisconnecting(false);
    }
  }

  return (
    <section className="max-w-2xl space-y-5 rounded-lg border border-border bg-card p-6">
      <h1 className="text-2xl font-serif text-primary">
        Google Calendar has been retired
      </h1>
      <p className="text-sm text-muted-foreground">
        Kindred no longer connects to Google Calendar, loads upcoming events, or
        uses calendar information in coaching. Your Google Calendar events have
        not been changed. Kindred reminders are still available.
      </p>
      {status.isPending ? (
        <p role="status">Checking for a previously saved connection…</p>
      ) : status.isError ? (
        <div className="space-y-2">
          <p role="alert">We could not check your saved connection.</p>
          <Button variant="outline" onClick={() => void status.refetch()}>
            Try again
          </Button>
        </div>
      ) : status.data.connected ? (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            You can remove your previously saved connection. Kindred will delete
            its saved access token and attempt to revoke access with Google.
          </p>
          <Button onClick={() => void disconnect()} disabled={disconnecting}>
            {disconnecting
              ? "Disconnecting…"
              : "Remove saved calendar connection"}
          </Button>
        </div>
      ) : (
        <p>No saved calendar connection remains in Kindred.</p>
      )}
      {message && <p role="status">{message}</p>}
      <p className="text-sm text-muted-foreground">
        You can also remove Kindred from your Google Account’s third-party
        connections.
      </p>
      <div className="flex gap-4 text-sm text-primary underline underline-offset-2">
        <Link href="/today">Back to Today</Link>
        <Link href="/app/reminders">Open reminders</Link>
      </div>
    </section>
  );
}
