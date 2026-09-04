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
 * URL migration to canonical `/today`, `/talk`, `/insights`, `/you` is
 * deliberately deferred (Phase 2C): every route keeps its existing href here.
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
  { area: "today", href: "/", label: "Today", icon: Home },
  { area: "talk", href: "/chat", label: "Talk", icon: MessageCircle },
  { area: "insights", href: "/reports", label: "Insights", icon: BarChart3 },
  { area: "you", href: "/profile", label: "You", icon: User },
];

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
 * Maps every legacy route to the primary area it belongs to, for active-state
 * grouping: navigating to a secondary route still highlights its primary area.
 */
export const ROUTE_TO_PRIMARY_AREA: Record<string, PrimaryArea> = {
  "/": "today",
  "/morning": "today",
  "/scans": "today",
  "/evening": "today",
  "/habits": "today",
  "/medications": "today",
  "/calendar": "today",
  "/reminders": "today",
  "/chat": "talk",
  "/archive": "talk",
  "/reports": "insights",
  "/profile": "you",
  "/account": "you",
};

/** Returns the primary area for a location path (falls back to `null`). */
export function primaryAreaForPath(location: string): PrimaryArea | null {
  return ROUTE_TO_PRIMARY_AREA[location] ?? null;
}

/** Every destination a signed-in member can reach, exactly once. */
export const ALL_SIGNED_IN_ROUTES: string[] = Object.keys(ROUTE_TO_PRIMARY_AREA);

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

/** The primary destination that anchors an area (e.g. Talk → /chat). */
export function areaPrimaryDestination(area: PrimaryArea): PrimaryDestination {
  const destination = PRIMARY_DESTINATIONS.find((d) => d.area === area);
  if (!destination) {
    throw new Error(`No primary destination for area: ${area}`);
  }
  return destination;
}
