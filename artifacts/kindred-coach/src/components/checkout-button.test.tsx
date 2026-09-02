import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createCheckout: vi.fn(),
  captureException: vi.fn(),
  getToken: vi.fn(),
  authState: { isLoaded: true, isSignedIn: true },
}));

vi.mock("@clerk/clerk-react", () => ({
  useAuth: () => ({
    getToken: mocks.getToken,
    isLoaded: mocks.authState.isLoaded,
    isSignedIn: mocks.authState.isSignedIn,
  }),
}));

vi.mock("@workspace/api-client-react", () => ({
  createCheckout: mocks.createCheckout,
}));

vi.mock("@sentry/react", () => ({
  captureException: mocks.captureException,
}));

import { CheckoutButton } from "./checkout-button";

describe("CheckoutButton", () => {
  let container: HTMLDivElement;
  let root: Root;
  let assignedHref: string;
  let originalLocation: Location;

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.authState.isLoaded = true;
    mocks.authState.isSignedIn = true;
    mocks.getToken.mockResolvedValue("test-token");
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);

    // jsdom does not implement navigation; capture `window.location.href`
    // assignment so the signed-out redirect can be asserted.
    assignedHref = "";
    originalLocation = window.location;
    Object.defineProperty(window, "location", {
      configurable: true,
      value: {
        get href() {
          return assignedHref;
        },
        set href(value: string) {
          assignedHref = value;
        },
      },
    });
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
    Object.defineProperty(window, "location", {
      configurable: true,
      value: originalLocation,
    });
  });

  it("normalizes a non-Error checkout rejection before reporting it", async () => {
    mocks.createCheckout.mockRejectedValue(undefined);

    await act(async () => {
      root.render(
        createElement(CheckoutButton, { planType: "yearly", label: "Start" }),
      );
    });

    await act(async () => {
      container.querySelector("button")!.click();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(mocks.captureException).toHaveBeenCalledWith(expect.any(Error), {
      tags: { checkout_plan_type: "yearly" },
    });
    expect(mocks.captureException.mock.calls[0][0]).toMatchObject({
      message: "Failed to start checkout",
    });
    expect(container.textContent).toContain(
      "Checkout isn't ready just yet — please try again shortly.",
    );
  });

  it("sends a signed-out visitor to the safe pricing login URL instead of checkout", async () => {
    mocks.authState.isSignedIn = false;

    await act(async () => {
      root.render(
        createElement(CheckoutButton, { planType: "lifetime", label: "Buy" }),
      );
    });

    await act(async () => {
      container.querySelector("button")!.click();
    });

    expect(assignedHref).toBe("/login?returnTo=%2Fpricing");
    expect(mocks.getToken).not.toHaveBeenCalled();
    expect(mocks.createCheckout).not.toHaveBeenCalled();
  });

  it("keeps the CTA disabled until Clerk has loaded", async () => {
    mocks.authState.isLoaded = false;

    await act(async () => {
      root.render(
        createElement(CheckoutButton, { planType: "yearly", label: "Start" }),
      );
    });

    const button = container.querySelector("button")!;
    expect(button.disabled).toBe(true);
  });
});
