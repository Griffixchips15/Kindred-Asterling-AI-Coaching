import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { PositiveAffirmations } from "./positive-affirmations";
vi.mock("@workspace/api-client-react", () => ({
  getListAffirmationsQueryKey: () => ["affirmations"],
  useListAffirmations: () => ({
    data: [{ text: "First affirmation" }, { text: "Second affirmation" }],
    isLoading: false,
    isError: false,
  }),
}));
let root: Root;
let container: HTMLDivElement;
let reduced = false;
let change: () => void;
beforeEach(() => {
  vi.useFakeTimers();
  reduced = false;
  vi.stubGlobal("matchMedia", () => ({
    matches: reduced,
    addEventListener: (_: string, listener: () => void) => {
      change = listener;
    },
    removeEventListener() {},
  }));
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});
afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});
it("does not auto-rotate with reduced motion, while manual navigation works", async () => {
  reduced = true;
  await act(async () => root.render(createElement(PositiveAffirmations)));
  await act(async () => vi.advanceTimersByTime(14000));
  expect(
    container.querySelector('[data-testid="affirmation-text"]')?.textContent,
  ).toBe("First affirmation");
  expect(
    container.querySelector('[data-testid="affirmation-pause"]'),
  ).toBeNull();
  await act(async () =>
    container
      .querySelector<HTMLButtonElement>('[data-testid="affirmation-next"]')!
      .click(),
  );
  expect(
    container.querySelector('[data-testid="affirmation-text"]')?.textContent,
  ).toBe("Second affirmation");
});
it("stops rotation when the system preference changes during use", async () => {
  await act(async () => root.render(createElement(PositiveAffirmations)));
  await act(async () => vi.advanceTimersByTime(7000));
  expect(
    container.querySelector('[data-testid="affirmation-text"]')?.textContent,
  ).toBe("Second affirmation");
  await act(async () => {
    reduced = true;
    change();
  });
  await act(async () => vi.advanceTimersByTime(7000));
  expect(
    container.querySelector('[data-testid="affirmation-text"]')?.textContent,
  ).toBe("Second affirmation");
});
