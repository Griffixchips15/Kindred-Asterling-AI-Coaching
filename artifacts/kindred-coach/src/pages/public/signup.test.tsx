import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  authState: { isLoaded: true, isSignedIn: false },
  search: "",
  assign: vi.fn(),
  fallbackRedirectUrl: "",
  signInUrl: "",
}));

vi.mock("@clerk/clerk-react", () => ({
  useUser: () => ({
    isLoaded: mocks.authState.isLoaded,
    isSignedIn: mocks.authState.isSignedIn,
  }),
  SignUp: (props: { fallbackRedirectUrl?: string; signInUrl?: string }) => {
    mocks.fallbackRedirectUrl = props.fallbackRedirectUrl ?? "";
    mocks.signInUrl = props.signInUrl ?? "";
    return null;
  },
}));

vi.mock("wouter", () => ({
  useSearch: () => mocks.search,
}));

vi.mock("@/assets/brand/logo-poster.jpg", () => ({ default: "poster.jpg" }));

import Signup from "./signup";

describe("Signup returnTo validation", () => {
  let container: HTMLDivElement;
  let root: Root;
  let originalLocation: Location;

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.authState.isLoaded = true;
    mocks.authState.isSignedIn = false;
    mocks.search = "";
    mocks.fallbackRedirectUrl = "";
    mocks.signInUrl = "";
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);

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

  it("passes a validated destination to Clerk and back to sign in", async () => {
    mocks.search = "returnTo=%2Fapp%2Fcalendar";

    await act(async () => {
      root.render(createElement(Signup));
    });

    expect(mocks.fallbackRedirectUrl).toBe("/app/calendar");
    expect(mocks.signInUrl).toBe("/login?returnTo=%2Fapp%2Fcalendar");
  });

  it("collapses unsafe destinations to canonical /app/today", async () => {
    mocks.search = "returnTo=https%3A%2F%2Fevil.example.com";

    await act(async () => {
      root.render(createElement(Signup));
    });

    expect(mocks.fallbackRedirectUrl).toBe("/app/today");
    expect(mocks.signInUrl).toBe("/login?returnTo=%2Fapp%2Ftoday");
  });

  it("redirects an already signed-in visitor safely", async () => {
    mocks.authState.isSignedIn = true;
    mocks.search = "returnTo=%2Fapp%2Fcalendar";

    await act(async () => {
      root.render(createElement(Signup));
    });

    expect(mocks.assign).toHaveBeenCalledWith("/app/calendar");
  });
});
