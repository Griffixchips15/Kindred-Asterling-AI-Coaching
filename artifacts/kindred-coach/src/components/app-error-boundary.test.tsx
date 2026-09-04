import { act, createElement, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AppErrorBoundary } from "./app-error-boundary";

function BrokenChild(): ReactNode {
  throw new Error("test render failure");
}

describe("AppErrorBoundary", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
  });

  it("renders its children while the application is healthy", async () => {
    await act(async () => {
      root.render(
        createElement(
          AppErrorBoundary,
          null,
          createElement("p", null, "Kindred is ready"),
        ),
      );
    });

    expect(container.textContent).toContain("Kindred is ready");
    expect(container.querySelector('[role="alert"]')).toBeNull();
  });

  it("shows the local recovery screen after a rendering failure", async () => {
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});

    await act(async () => {
      root.render(
        createElement(AppErrorBoundary, null, createElement(BrokenChild)),
      );
    });

    const alert = container.querySelector('[role="alert"]');
    expect(alert?.textContent).toContain("Something went wrong");
    expect(alert?.textContent).toContain(
      "Please refresh the page and try again.",
    );
    consoleError.mockRestore();
  });
});
