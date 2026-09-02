import { describe, expect, it } from "vitest";
import {
  ALL_SIGNED_IN_ROUTES,
  PRIMARY_DESTINATIONS,
  ROUTE_TO_PRIMARY_AREA,
  SECONDARY_NAV_ITEMS,
  primaryAreaForPath,
} from "./navigation";

describe("navigation model", () => {
  it("defines exactly four primary destinations in order", () => {
    expect(PRIMARY_DESTINATIONS.map((d) => d.area)).toEqual([
      "today",
      "talk",
      "insights",
      "you",
    ]);

    // Canonical hrefs are deliberately NOT migrated in Phase 2A.
    expect(PRIMARY_DESTINATIONS.map((d) => d.href)).toEqual([
      "/",
      "/chat",
      "/reports",
      "/profile",
    ]);
    expect(PRIMARY_DESTINATIONS.map((d) => d.label)).toEqual([
      "Today",
      "Talk",
      "Insights",
      "You",
    ]);
  });

  it("exposes every lower-frequency destination in the secondary list", () => {
    const secondaryHrefs = SECONDARY_NAV_ITEMS.map((i) => i.href);
    expect(secondaryHrefs).toContain("/morning");
    expect(secondaryHrefs).toContain("/scans");
    expect(secondaryHrefs).toContain("/evening");
    expect(secondaryHrefs).toContain("/habits");
    expect(secondaryHrefs).toContain("/medications");
    expect(secondaryHrefs).toContain("/calendar");
    expect(secondaryHrefs).toContain("/reminders");
    expect(secondaryHrefs).toContain("/account");
    expect(secondaryHrefs).toContain("/archive");
  });

  it("keeps every legacy signed-in route reachable exactly once", () => {
    const expected = [
      "/",
      "/morning",
      "/scans",
      "/evening",
      "/habits",
      "/medications",
      "/reports",
      "/profile",
      "/account",
      "/calendar",
      "/chat",
      "/archive",
      "/reminders",
    ];
    expect(ALL_SIGNED_IN_ROUTES.sort()).toEqual(expected.sort());

    const presented = [
      ...PRIMARY_DESTINATIONS.map((d) => d.href),
      ...SECONDARY_NAV_ITEMS.map((i) => i.href),
    ];
    for (const href of expected) {
      expect(presented).toContain(href);
      expect(presented.filter((h) => h === href)).toHaveLength(1);
    }
  });

  it("maps daily-routine routes to the Today primary area", () => {
    for (const href of [
      "/",
      "/morning",
      "/scans",
      "/evening",
      "/habits",
      "/medications",
      "/calendar",
      "/reminders",
    ]) {
      expect(ROUTE_TO_PRIMARY_AREA[href]).toBe("today");
    }
  });

  it("groups Talk, Insights, and You routes correctly", () => {
    expect(ROUTE_TO_PRIMARY_AREA["/chat"]).toBe("talk");
    expect(ROUTE_TO_PRIMARY_AREA["/archive"]).toBe("talk");
    expect(ROUTE_TO_PRIMARY_AREA["/reports"]).toBe("insights");
    expect(ROUTE_TO_PRIMARY_AREA["/profile"]).toBe("you");
    expect(ROUTE_TO_PRIMARY_AREA["/account"]).toBe("you");
  });

  it("resolves a location path to its primary area", () => {
    expect(primaryAreaForPath("/morning")).toBe("today");
    expect(primaryAreaForPath("/archive")).toBe("talk");
    expect(primaryAreaForPath("/reports")).toBe("insights");
    expect(primaryAreaForPath("/")).toBe("today");
  });

  it("returns null for unknown paths", () => {
    expect(primaryAreaForPath("/bogus")).toBeNull();
  });
});
