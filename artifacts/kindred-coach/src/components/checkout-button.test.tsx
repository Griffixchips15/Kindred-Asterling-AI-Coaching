import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createCheckout: vi.fn(),
  captureException: vi.fn(),
  getToken: vi.fn(),
}));

vi.mock("@clerk/clerk-react", () => ({
  useAuth: () => ({
    getToken: mocks.getToken,
    isLoaded: true,
    isSignedIn: true,
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

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getToken.mockResolvedValue("test-token");
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
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
});
