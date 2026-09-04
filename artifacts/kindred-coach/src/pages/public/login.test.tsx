import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  authState: { isLoaded: true, isSignedIn: false },
  search: "",
  assign: vi.fn(),
  fallbackRedirectUrl: "",
}));

vi.mock("@clerk/clerk-react", () => ({
  useUser: () => ({
    isLoaded: mocks.authState.isLoaded,
    isSignedIn: mocks.authState.isSignedIn,
  }),
  SignIn: (props: { fallbackRedirectUrl?: string }) => {
    mocks.fallbackRedirectUrl = props.fallbackRedirectUrl ?? "";
    return null;
  },
}));

vi.mock("wouter", () => ({
  useSearch: () => mocks.search,
}));

vi.mock("@/assets/brand/logo-poster.jpg", () => ({ default: "poster.jpg" }));

import Login from "./login";

describe("Login returnTo validation", () => {
  let container: HTMLDivElement;
  let root: Root;
  let originalLocation: Location;

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.authState.isLoaded = true;
    mocks.authState.isSignedIn = false;
    mocks.search = "";
    mocks.fallbackRedirectUrl = "";
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);

    // jsdom does not implement navigation; capture `window.location.assign`.
    originalLocation = window.location;
    Object.defineProperty(window, "location", {
      configurable: true,
      value: { assign: mocks.assign },
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

  it("passes a validated safe return destination to Clerk's fallbackRedirectUrl", async () => {
    mocks.search = "returnTo=%2Fpricing";

    await act(async () => {
      root.render(createElement(Login));
    });

    expect(mocks.fallbackRedirectUrl).toBe("/pricing");
  });

  it("collapses an unsafe return destination to /app in fallbackRedirectUrl", async () => {
    mocks.search = "returnTo=https%3A%2F%2Fevil.example.com";

    await act(async () => {
      root.render(createElement(Login));
    });

    expect(mocks.fallbackRedirectUrl).toBe("/app");
  });

  it("navigates a signed-in visitor to a safe return destination", async () => {
    mocks.authState.isSignedIn = true;
    mocks.search = "returnTo=%2Fpricing";

    await act(async () => {
      root.render(createElement(Login));
    });

    expect(mocks.assign).toHaveBeenCalledWith("/pricing");
  });

  it("never navigates a signed-in visitor to an unsafe external URL", async () => {
    mocks.authState.isSignedIn = true;
    mocks.search = "returnTo=https%3A%2F%2Fevil.example.com";

    await act(async () => {
      root.render(createElement(Login));
    });

    expect(mocks.assign).toHaveBeenCalledWith("/app");
    expect(mocks.assign).not.toHaveBeenCalledWith(
      expect.stringContaining("evil.example.com"),
    );
  });
});
