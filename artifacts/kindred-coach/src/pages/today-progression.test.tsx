import { act, createElement, type ComponentType } from "react";
import { createRoot, type Root } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { format } from "date-fns";
import Dashboard from "./dashboard";
import Morning from "./morning";
import Scans from "./scans";
import Habits from "./habits";

vi.mock("@/components/dashboard/positive-affirmations", () => ({
  PositiveAffirmations: () => null,
}));
vi.mock("@/components/charts/weekly-habit-completion", () => ({
  WeeklyHabitCompletion: () => null,
}));

// Keep the real generated query/mutation hooks and QueryClient. Mock only HTTP,
// so these tests detect a stale Today cache when returning from a journal page.
describe("Today progression after navigating back from a save", () => {
  let container: HTMLDivElement;
  let root: Root;
  let client: QueryClient;
  let summary: {
    morningDone: boolean;
    eveningDone: boolean;
    bodyScansCount: number;
    habitsCompletedToday: number;
    totalHabits: number;
  };
  let morningDate: string | undefined;
  let summaryRequests: number;

  beforeEach(() => {
    summary = {
      morningDone: false,
      eveningDone: false,
      bodyScansCount: 0,
      habitsCompletedToday: 0,
      totalHabits: 1,
    };
    summaryRequests = 0;
    morningDate = undefined;
    client = new QueryClient({
      defaultOptions: {
        queries: { retry: false, staleTime: Infinity },
        mutations: { retry: false },
      },
    });
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
    vi.stubGlobal(
      "ResizeObserver",
      class {
        observe() {}
        unobserve() {}
        disconnect() {}
      },
    );
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string, options?: RequestInit) => {
        const url = new URL(input, "http://localhost");
        const method = options?.method ?? "GET";
        const body = options?.body ? JSON.parse(String(options.body)) : {};
        let result: unknown = [];
        if (url.pathname === "/api/dashboard/today") {
          expect(url.searchParams.get("tzOffset")).toBe(
            String(new Date().getTimezoneOffset()),
          );
          summaryRequests++;
          result = {
            ...summary,
            date: format(new Date(), "yyyy-MM-dd"),
            currentMentalLoad: "mild",
          };
        } else if (url.pathname === "/api/morning-logs" && method === "POST") {
          morningDate = body.date;
          summary.morningDone = true;
          result = { id: 1, ...body };
        } else if (url.pathname === "/api/body-scans" && method === "POST") {
          summary.bodyScansCount++;
          result = { id: 1, ...body };
        } else if (
          url.pathname === "/api/habits/1/entries" &&
          method === "POST"
        ) {
          summary.habitsCompletedToday = 1;
          result = { id: 1, habitId: 1, ...body };
        } else if (url.pathname === "/api/habits") {
          result = [
            {
              id: 1,
              name: "Test habit",
              targetDays: 7,
              completedCount: summary.habitsCompletedToday,
              startDate: "2026-09-01",
            },
          ];
        }
        return new Response(JSON.stringify(result), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }),
    );
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
    client.clear();
    vi.unstubAllGlobals();
  });

  async function render(Page: ComponentType) {
    await act(async () => {
      root.render(
        createElement(QueryClientProvider, { client }, createElement(Page)),
      );
    });
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 20));
    });
  }

  async function click(selector: string) {
    const element = container.querySelector<HTMLButtonElement>(selector);
    expect(element).not.toBeNull();
    await act(async () => element!.click());
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 20));
    });
  }

  function nextStep() {
    return container.querySelector('[data-testid="next-step-title"]')
      ?.textContent;
  }

  it("advances from morning after saving a check-in with a date-only value", async () => {
    await render(Dashboard);
    expect(nextStep()).toBe("Begin your day");
    await render(Morning);
    const goal = container.querySelector<HTMLInputElement>(
      'input[name="goal1"]',
    )!;
    await act(async () => {
      Object.getOwnPropertyDescriptor(
        HTMLInputElement.prototype,
        "value",
      )!.set!.call(goal, "Test goal");
      goal.dispatchEvent(new Event("input", { bubbles: true }));
    });
    await act(async () => {
      container
        .querySelector("form")!
        .dispatchEvent(
          new Event("submit", { bubbles: true, cancelable: true }),
        );
    });
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 20));
    });
    expect(morningDate).toBe(format(new Date(), "yyyy-MM-dd"));
    await render(Dashboard);
    expect(summaryRequests).toBe(2);
    expect(nextStep()).toBe("Notice what's here");
    expect(container.textContent).toContain("Completed");
  });

  it("advances from a body scan to the unfinished habit", async () => {
    summary.morningDone = true;
    await render(Dashboard);
    expect(nextStep()).toBe("Notice what's here");
    await render(Scans);
    await click('[data-testid="core-happy"]');
    await click('[data-testid="feeling-happy"]');
    await click('[data-testid="button-log-scan"]');
    await render(Dashboard);
    expect(summaryRequests).toBe(2);
    expect(nextStep()).toBe("Tend a small habit");
    expect(container.textContent).toContain("1 scan today");
  });

  it("updates the journey after completing a habit", async () => {
    summary.morningDone = true;
    summary.bodyScansCount = 1;
    summary.eveningDone = true;
    await render(Dashboard);
    expect(nextStep()).toBe("Tend a small habit");
    await render(Habits);
    await click('[data-testid="button-toggle-habit-1"]');
    await render(Dashboard);
    expect(summaryRequests).toBe(2);
    expect(nextStep()).toBe("You're on track");
    expect(container.textContent).toContain("Habits complete");
  });
});
