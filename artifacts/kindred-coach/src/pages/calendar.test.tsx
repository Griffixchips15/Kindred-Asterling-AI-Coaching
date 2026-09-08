import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getGetUpcomingCalendarEventsQueryKey } from "@workspace/api-client-react";

const auth = vi.hoisted(() => ({ getToken: vi.fn(async () => "test-token") }));
vi.mock("@clerk/clerk-react", () => ({ useAuth: () => auth }));
import CalendarPage from "./calendar";

let root: Root;
let container: HTMLDivElement;
let queryClient: QueryClient;
let fetchMock: ReturnType<typeof vi.fn>;
const response = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status });

async function renderPage() {
  await act(async () => {
    root.render(
      createElement(
        QueryClientProvider,
        { client: queryClient },
        createElement(CalendarPage),
      ),
    );
    await new Promise((resolve) => setTimeout(resolve, 20));
  });
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 20));
  });
}

beforeEach(() => {
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(async () => {
  await act(async () => root.unmount());
  queryClient.clear();
  container.remove();
  vi.unstubAllGlobals();
});

describe("Calendar sunset", () => {
  it("keeps legacy links useful without loading events or offering new connections", async () => {
    fetchMock.mockResolvedValue(
      response({ retired: true, configured: false, connected: false }),
    );
    await renderPage();
    expect(container.textContent).toContain("Google Calendar has been retired");
    expect(container.textContent).toContain(
      "No saved calendar connection remains",
    );
    expect(container.querySelector('a[href="/today"]')).not.toBeNull();
    expect(container.querySelector('a[href="/app/reminders"]')).not.toBeNull();
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/calendar/status",
      expect.objectContaining({
        headers: { Authorization: "Bearer test-token" },
      }),
    );
    expect(container.querySelector("button")).toBeNull();
  });

  it("retains user-initiated disconnect and clears previously cached events", async () => {
    queryClient.setQueryData(getGetUpcomingCalendarEventsQueryKey(), [
      { title: "old event" },
    ]);
    fetchMock
      .mockResolvedValueOnce(response({ connected: true }))
      .mockResolvedValueOnce(new Response(null, { status: 204 }));
    await renderPage();
    expect(fetchMock).toHaveBeenCalledOnce();
    const button = container.querySelector("button")!;
    expect(button.textContent).toBe("Remove saved calendar connection");
    await act(async () => button.click());
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 20));
    });
    expect(fetchMock).toHaveBeenLastCalledWith("/api/calendar/connection", {
      method: "DELETE",
      headers: { Authorization: "Bearer test-token" },
    });
    expect(container.textContent).toContain("removed from Kindred");
    expect(
      queryClient.getQueryData(getGetUpcomingCalendarEventsQueryKey()),
    ).toBeUndefined();
    expect(container.querySelector("button")).toBeNull();
  });

  it("does not claim successful cleanup after a failed disconnect", async () => {
    fetchMock
      .mockResolvedValueOnce(response({ connected: true }))
      .mockResolvedValueOnce(response({ error: "unavailable" }, 503));
    await renderPage();
    await act(async () => container.querySelector("button")!.click());
    expect(container.textContent).toContain(
      "could not remove your saved connection",
    );
    expect(container.querySelector("button")?.disabled).toBe(false);
  });

  it("shows a retry when saved-connection status cannot be checked", async () => {
    fetchMock.mockResolvedValue(response({ error: "unavailable" }, 503));
    await renderPage();
    expect(container.querySelector('[role="alert"]')?.textContent).toContain(
      "could not check",
    );
    expect(container.textContent).not.toContain(
      "No saved calendar connection remains",
    );
    expect(container.querySelector("button")?.textContent).toBe("Try again");
  });
});
