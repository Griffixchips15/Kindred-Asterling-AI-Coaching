import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  events: [] as { date: string; time: string; title: string }[],
  isLoading: true,
  isError: false,
}));

vi.mock("@workspace/api-client-react", () => ({
  useGetUpcomingCalendarEvents: () => ({
    data: mocks.events,
    isLoading: mocks.isLoading,
    isError: mocks.isError,
  }),
}));

import { TodayCalendarSummary } from "./today-calendar-summary";

describe("TodayCalendarSummary", () => {
  let container: HTMLDivElement;
  let root: Root;
  let queryClient: QueryClient;

  beforeEach(() => {
    mocks.events = [];
    mocks.isLoading = true;
    mocks.isError = false;
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
    queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
    queryClient.clear();
  });

  function renderSummary() {
    return act(async () => {
      root.render(
        createElement(
          QueryClientProvider,
          { client: queryClient },
          createElement(TodayCalendarSummary),
        ),
      );
    });
  }

  it("shows a loading state before data resolves", async () => {
    mocks.isLoading = true;
    await renderSummary();
    expect(container.textContent).toContain("Loading your calendar");
  });

  it("distinguishes the genuinely empty state", async () => {
    mocks.isLoading = false;
    mocks.events = [];
    await renderSummary();
    expect(container.querySelector('[data-testid="calendar-summary-empty"]'))
      .not.toBeNull();
    expect(container.textContent).toContain("No events in the next 3 days");
  });

  it("distinguishes the unavailable/error state", async () => {
    mocks.isLoading = false;
    mocks.isError = true;
    await renderSummary();
    expect(
      container.querySelector('[data-testid="calendar-summary-unavailable"]'),
    ).not.toBeNull();
  });

  it("shows count and timing window but never event titles", async () => {
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const iso = (d: Date) => d.toISOString().split("T")[0];

    mocks.isLoading = false;
    mocks.events = [
      { date: iso(today), time: "09:00", title: "Secret therapy session" },
      { date: iso(tomorrow), time: "14:30", title: "Private appointment" },
    ];
    await renderSummary();

    expect(container.querySelector('[data-testid="calendar-summary-loaded"]'))
      .not.toBeNull();
    expect(container.textContent).toContain("2");
    // Timing window (earliest – latest) appears; titles must not.
    expect(container.textContent).toContain("09:00");
    expect(container.textContent).toContain("14:30");
    expect(container.textContent).not.toContain("Secret therapy session");
    expect(container.textContent).not.toContain("Private appointment");
  });

  it("shows day labels and a timing window while titles remain absent", async () => {
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const iso = (d: Date) => d.toISOString().split("T")[0];

    mocks.isLoading = false;
    mocks.events = [
      { date: iso(today), time: "08:00", title: "Confidential standup" },
      { date: iso(tomorrow), time: "16:00", title: "Doctor appointment" },
    ];
    await renderSummary();

    // Day labels for represented dates are shown.
    expect(container.textContent).toContain("Today");
    expect(container.textContent).toContain("Tomorrow");
    // Timing window is shown.
    expect(container.textContent).toContain("08:00 – 16:00");
    // But no titles.
    expect(container.textContent).not.toContain("Confidential standup");
    expect(container.textContent).not.toContain("Doctor appointment");
  });
});
