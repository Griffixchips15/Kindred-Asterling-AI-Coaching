import type { LucideIcon } from "lucide-react";
import {
  Home,
  MessageCircle,
  BarChart3,
  User,
  Sunrise,
  ScanLine,
  Sunset,
  ListTodo,
  Pill,
  CalendarDays,
  Bell,
  UserRoundCog,
  Archive as ArchiveIcon,
} from "lucide-react";

/**
 * Signed-in application navigation model.
 *
 * The signed-in product organises its thirteen routes under four *primary
 * destinations* (Today, Talk, Insights, You). Lower-frequency routes remain
 * reachable but are presented as secondary items rather than a flat 13-item
 * list.
 *
 * The four primary destinations use the canonical Phase 2C URLs. Legacy
 * primary URLs remain redirect aliases in App.tsx so existing bookmarks keep
 * working without appearing as duplicate navigation destinations.
 */

export type PrimaryArea = "today" | "talk" | "insights" | "you";

export interface NavigationItem {
  /** Route href as currently served (relative to the `/app` router). */
  href: string;
  /** Display label. */
  label: string;
  icon: LucideIcon;
}

export interface PrimaryDestination extends NavigationItem {
  /** Stable area key used for active-state grouping and aria labels. */
  area: PrimaryArea;
}

/** The four primary destinations shown in the desktop sidebar and mobile tab bar. */
export const PRIMARY_DESTINATIONS: PrimaryDestination[] = [
  { area: "today", href: "/today", label: "Today", icon: Home },
  { area: "talk", href: "/talk", label: "Talk", icon: MessageCircle },
  { area: "insights", href: "/insights", label: "Insights", icon: BarChart3 },
  { area: "you", href: "/you", label: "You", icon: User },
];

/**
 * Backward-compatible aliases for the four pre-Phase-2C primary URLs.
 * These are route concerns only and must not be rendered as navigation items.
 */
export const LEGACY_PRIMARY_ROUTE_REDIRECTS: Record<string, string> = {
  "/": "/today",
  "/chat": "/talk",
  "/reports": "/insights",
  "/profile": "/you",
};

/** Lower-frequency routes, surfaced via the secondary navigation. */
export const SECONDARY_NAV_ITEMS: NavigationItem[] = [
  { href: "/morning", label: "Morning", icon: Sunrise },
  { href: "/scans", label: "Scans", icon: ScanLine },
  { href: "/evening", label: "Evening", icon: Sunset },
  { href: "/habits", label: "Habits", icon: ListTodo },
  { href: "/medications", label: "Medications", icon: Pill },
  { href: "/calendar", label: "Calendar", icon: CalendarDays },
  { href: "/reminders", label: "Reminders", icon: Bell },
  { href: "/account", label: "Account security", icon: UserRoundCog },
  { href: "/archive", label: "Archive", icon: ArchiveIcon },
];

/**
 * Maps every canonical, secondary, and legacy alias route to the primary area
 * it belongs to. Navigating to a secondary route still highlights its primary
 * area, and an alias has a stable active state while its redirect is applied.
 */
export const ROUTE_TO_PRIMARY_AREA: Record<string, PrimaryArea> = {
  "/today": "today",
  "/morning": "today",
  "/scans": "today",
  "/evening": "today",
  "/habits": "today",
  "/medications": "today",
  "/calendar": "today",
  "/reminders": "today",
  "/talk": "talk",
  "/archive": "talk",
  "/insights": "insights",
  "/you": "you",
  "/account": "you",
  "/": "today",
  "/chat": "talk",
  "/reports": "insights",
  "/profile": "you",
};

/** Returns the primary area for a location path (falls back to `null`). */
export function primaryAreaForPath(location: string): PrimaryArea | null {
  return ROUTE_TO_PRIMARY_AREA[location] ?? null;
}

/** Every destination presented to a signed-in member, exactly once. */
export const ALL_SIGNED_IN_ROUTES: string[] = [
  ...PRIMARY_DESTINATIONS.map((destination) => destination.href),
  ...SECONDARY_NAV_ITEMS.map((item) => item.href),
];

function bucketSecondaryRoutesByArea(): Record<PrimaryArea, NavigationItem[]> {
  const buckets: Record<PrimaryArea, NavigationItem[]> = {
    today: [],
    talk: [],
    insights: [],
    you: [],
  };
  for (const item of SECONDARY_NAV_ITEMS) {
    const area = ROUTE_TO_PRIMARY_AREA[item.href];
    if (area) buckets[area].push(item);
  }
  return buckets;
}

/**
 * Secondary routes bucketed by the primary area they belong to (derived from
 * the same model that drives the navigation shell). Insights currently has no
 * secondary routes; Talk has Archive; You has Account security.
 */
export const AREA_SECONDARY_ROUTES: Record<PrimaryArea, NavigationItem[]> =
  bucketSecondaryRoutesByArea();

/**
 * The secondary destinations of a primary area, optionally excluding the page
 * the visitor is already on. Primary-area pages use this to surface the rest
 * of their area without duplicating the navigation model.
 */
export function areaSecondaryDestinations(
  area: PrimaryArea,
  opts: { excludeHref?: string } = {},
): NavigationItem[] {
  return AREA_SECONDARY_ROUTES[area].filter(
    (item) => item.href !== opts?.excludeHref,
  );
}

/** The primary destination that anchors an area (e.g. Talk → /talk). */
export function areaPrimaryDestination(area: PrimaryArea): PrimaryDestination {
  const destination = PRIMARY_DESTINATIONS.find((d) => d.area === area);
  if (!destination) {
    throw new Error(`No primary destination for area: ${area}`);
  }
  return destination;
}
