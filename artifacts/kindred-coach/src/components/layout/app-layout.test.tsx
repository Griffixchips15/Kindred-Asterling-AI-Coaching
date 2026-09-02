import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  location: "/",
  getToken: vi.fn(),
  authUser: null,
}));

vi.mock("wouter", () => ({
  Link: ({ href, children, onClick, ...rest }: any) =>
    createElement(
      "a",
      {
        href,
        ...rest,
        onClick: (event: MouseEvent) => {
          event.preventDefault();
          onClick?.(event);
        },
      },
      children,
    ),
  useLocation: () => [mocks.location],
}));

vi.mock("@clerk/clerk-react", () => ({
  useAuth: () => ({ getToken: mocks.getToken, signOut: vi.fn() }),
}));

vi.mock("@workspace/api-client-react", () => ({
  getGetCurrentAuthUserQueryKey: () => ["/api/auth/user"],
  useGetCurrentAuthUser: () => ({ data: mocks.authUser }),
}));

vi.mock("@/hooks/use-theme", () => ({
  useTheme: () => ({ theme: "quiet-sage", setTheme: vi.fn() }),
  THEME_OPTIONS: [{ value: "quiet-sage", label: "Quiet Sage", swatches: ["#000"] }],
}));

vi.mock("@/assets/brand/logo-mark.png", () => ({ default: "logo.png" }));

import { TooltipProvider } from "@/components/ui/tooltip";

import { AppLayout } from "./app-layout";

function renderAppLayout() {
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const tree = createElement(
    QueryClientProvider,
    { client: queryClient },
    createElement(
      TooltipProvider,
      null,
      createElement(AppLayout, { children: null }),
    ),
  );
  return { container, root, tree, queryClient };
}

describe("AppLayout", () => {
  let render: ReturnType<typeof renderAppLayout>;

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.location = "/";
    mocks.authUser = null;
    render = renderAppLayout();
  });

  afterEach(async () => {
    await act(async () => render.root.unmount());
    render.container.remove();
    render.queryClient.clear();
  });

  it("renders the four primary destinations on desktop", async () => {
    await act(async () => {
      render.root.render(render.tree);
    });

    const container = render.container;
    for (const area of ["today", "talk", "insights", "you"]) {
      expect(container.querySelector(`[data-testid="nav-primary-${area}"]`))
        .not.toBeNull();
    }
    expect(
      container.querySelectorAll('[data-testid^="nav-primary-"]'),
    ).toHaveLength(4);
  });

  it("marks the active primary destination with aria-current", async () => {
    mocks.location = "/chat";
    await act(async () => {
      render.root.render(render.tree);
    });

    const talk = render.container.querySelector(
      '[data-testid="nav-primary-talk"]',
    );
    expect(talk).not.toBeNull();
    expect(talk!.getAttribute("aria-current")).toBe("page");
    expect(
      render.container
        .querySelector('[data-testid="nav-primary-today"]')!
        .getAttribute("aria-current"),
    ).toBeNull();
  });

  it("groups a daily-routine route under the Today primary area", async () => {
    mocks.location = "/morning";
    await act(async () => {
      render.root.render(render.tree);
    });

    expect(
      render.container
        .querySelector('[data-testid="nav-primary-today"]')!
        .getAttribute("aria-current"),
    ).toBe("page");
  });

  it("renders the fixed mobile bottom nav with four destinations and a More menu", async () => {
    await act(async () => {
      render.root.render(render.tree);
    });

    const bottomNav = render.container.querySelector(
      'nav[aria-label="Primary navigation"].md\\:hidden',
    );
    expect(bottomNav).not.toBeNull();
    // Four destinations + the "More" trigger share the bottom nav.
    expect(
      render.container.querySelector('[data-testid="mobile-more-trigger"]'),
    ).not.toBeNull();
    const links = bottomNav!.querySelectorAll("a");
    expect(links).toHaveLength(4);
    const labels = Array.from(links).map((a) => a.textContent);
    expect(labels).toEqual(["Today", "Talk", "Insights", "You"]);
  });

  it("hides the desktop sidebar on small screens and shows it on large screens", async () => {
    await act(async () => {
      render.root.render(render.tree);
    });

    // Desktop sidebar is `hidden md:flex`; bottom nav is `md:hidden`.
    const sidebar = render.container.querySelector(
      'aside[aria-label="Primary navigation"].hidden',
    );
    expect(sidebar).not.toBeNull();
    expect(sidebar!.className).toContain("md:flex");

    const bottomNav = render.container.querySelector(
      'nav[aria-label="Primary navigation"].md\\:hidden',
    );
    expect(bottomNav).not.toBeNull();
  });

  it("closes the mobile More sheet after choosing a destination", async () => {
    await act(async () => {
      render.root.render(render.tree);
    });

    const moreTrigger = render.container.querySelector<HTMLButtonElement>(
      '[data-testid="mobile-more-trigger"]',
    );
    expect(moreTrigger).not.toBeNull();

    await act(async () => {
      moreTrigger!.click();
    });

    const openSheet = document.querySelector(
      '[role="dialog"][data-state="open"]',
    );
    expect(openSheet).not.toBeNull();
    const morningLink = Array.from(openSheet!.querySelectorAll("a")).find(
      (link) => link.textContent === "Morning",
    );
    expect(morningLink).not.toBeUndefined();

    await act(async () => {
      morningLink!.click();
    });

    expect(
      document.querySelector('[role="dialog"][data-state="open"]'),
    ).toBeNull();
  });
});
