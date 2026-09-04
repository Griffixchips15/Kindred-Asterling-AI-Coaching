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

vi.mock("wouter", () => ({
  Link: ({ href, children, ...rest }: any) =>
    createElement("a", { href, ...rest }, children),
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

  it("orders day labels chronologically and spans the true timing window", async () => {
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const iso = (d: Date) => d.toISOString().split("T")[0];

    mocks.isLoading = false;
    // A late event today and an early event tomorrow: the window must span
    // 07:30 – 21:00 even though "Today" sorts before "Tomorrow".
    mocks.events = [
      { date: iso(today), time: "21:00", title: "Evening commitment" },
      { date: iso(tomorrow), time: "07:30", title: "Early commitment" },
    ];
    await renderSummary();

    const labels = Array.from(
      container.querySelectorAll('[data-testid="calendar-summary-loaded"] p'),
    )
      .map((p) => p.textContent)
      .find((t) => t?.startsWith("When"))!;

    // "Today" must appear before "Tomorrow" (chronological by date, not by time).
    expect(labels.indexOf("Today")).toBeLessThan(labels.indexOf("Tomorrow"));
    // Earliest/latest are computed separately from the label ordering.
    expect(container.textContent).toContain("07:30 – 21:00");
    // Titles remain hidden.
    expect(container.textContent).not.toContain("Evening commitment");
    expect(container.textContent).not.toContain("Early commitment");
  });

  it("links to the full calendar page for details", async () => {
    const today = new Date();
    const iso = (d: Date) => d.toISOString().split("T")[0];
    mocks.isLoading = false;
    mocks.events = [{ date: iso(today), time: "09:00", title: "Private" }];
    await renderSummary();

    const link = container.querySelector<HTMLAnchorElement>(
      '[data-testid="calendar-summary-link"]',
    );
    expect(link).not.toBeNull();
    expect(link!.getAttribute("href")).toBe("/calendar");
    expect(link!.textContent).toContain("Open your calendar");
    // min-h-11 is Tailwind's 44px minimum touch target.
    expect(link!.className).toContain("min-h-11");
    expect(link!.className).toContain("inline-flex");
  });
});
