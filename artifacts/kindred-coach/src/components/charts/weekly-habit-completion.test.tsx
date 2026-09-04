import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { WeeklyHabitCompletion } from "./weekly-habit-completion";

class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}

describe("WeeklyHabitCompletion", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    vi.stubGlobal("ResizeObserver", ResizeObserverMock);
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
    vi.unstubAllGlobals();
  });

  it("shows no sample completion values when data is absent", async () => {
    await act(async () => {
      root.render(createElement(WeeklyHabitCompletion, {}));
    });

    expect(container.textContent).not.toMatch(/Average this week/);
    for (const sample of ["80%", "95%", "70%", "85%", "100%", "60%", "75%"]) {
      expect(container.textContent).not.toContain(sample);
    }
  });

  it("renders the honest empty state when no data is supplied", async () => {
    await act(async () => {
      root.render(createElement(WeeklyHabitCompletion, {}));
    });

    expect(
      container.querySelector('[data-testid="weekly-habit-completion-empty"]'),
    ).not.toBeNull();
    expect(container.textContent).toContain("No habit completion data yet.");
  });

  it("renders supplied real data with a computed average", async () => {
    await act(async () => {
      root.render(
        createElement(WeeklyHabitCompletion, {
          data: [
            { day: "Monday", completion: 50 },
            { day: "Tuesday", completion: 100 },
          ],
        }),
      );
    });

    expect(container.textContent).toContain("Average this week: 75%");
    expect(
      container.querySelector('[data-testid="weekly-habit-completion-empty"]'),
    ).toBeNull();
  });
});
