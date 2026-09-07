import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it } from "vitest";
import { Redirect, Route, Router, Switch } from "wouter";
import { memoryLocation } from "wouter/memory-location";
import { LEGACY_PRIMARY_ROUTE_REDIRECTS } from "./navigation";

const appSource = readFileSync(resolve(process.cwd(), "src/App.tsx"), "utf8");
const paymentSuccessSource = readFileSync(
  resolve(process.cwd(), "src/pages/public/payment-success.tsx"),
  "utf8",
);

describe("Phase 2C canonical application routes", () => {
  it("mounts each primary experience on its canonical path", () => {
    expect(appSource).toContain(
      '<Route path="/today" component={Dashboard} />',
    );
    expect(appSource).toContain('<Route path="/talk" component={Chat} />');
    expect(appSource).toContain(
      '<Route path="/insights" component={Reports} />',
    );
    expect(appSource).toContain('<Route path="/you" component={Profile} />');
  });

  it("renders every legacy primary URL through a replace redirect", () => {
    expect(LEGACY_PRIMARY_ROUTE_REDIRECTS).toEqual({
      "/": "/today",
      "/chat": "/talk",
      "/reports": "/insights",
      "/profile": "/you",
    });
    expect(appSource).toContain(
      "Object.entries(LEGACY_PRIMARY_ROUTE_REDIRECTS)",
    );
    expect(appSource).toContain("<Redirect to={canonicalPath} replace />");
  });

  it.each(Object.entries(LEGACY_PRIMARY_ROUTE_REDIRECTS))(
    "redirects legacy %s to canonical %s inside the /app router",
    async (legacyPath, canonicalPath) => {
      const initialPath = legacyPath === "/" ? "/app" : `/app${legacyPath}`;
      const location = memoryLocation({ path: initialPath, record: true });
      const container = document.createElement("div");
      document.body.append(container);
      const root = createRoot(container);

      await act(async () => {
        root.render(
          createElement(
            Router,
            { base: "/app", hook: location.hook },
            createElement(
              Switch,
              null,
              ...Object.entries(LEGACY_PRIMARY_ROUTE_REDIRECTS).map(
                ([from, to]) =>
                  createElement(
                    Route,
                    { key: from, path: from },
                    createElement(Redirect, { to, replace: true }),
                  ),
              ),
            ),
          ),
        );
      });

      expect(location.history).toEqual([`/app${canonicalPath}`]);

      await act(async () => root.unmount());
      container.remove();
    },
  );

  it("uses Today as the completion destination for Clerk tasks", () => {
    expect(appSource.match(/redirectUrlComplete="\/app\/today"/g)).toHaveLength(
      3,
    );
  });

  it("returns successful checkout visitors to canonical Today", () => {
    expect(paymentSuccessSource).toContain("}/app/today`");
  });
});
