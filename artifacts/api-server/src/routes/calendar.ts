import { Router, type IRouter } from "express";
import { requireAuth } from "../middlewares/requireAuth";
import { fetchUpcomingEvents } from "../lib/googleCalendar";

const router: IRouter = Router();

// The Google Calendar connector is project-scoped (Replit Connectors tie the
// OAuth tokens to the app builder's Replit account, not to the requesting
// end-user). Returning that data to every authenticated user would leak the
// builder's personal schedule to the entire user base. Until per-user OAuth
// exists, this endpoint must be restricted to a single allow-listed user.
// Fail closed: if CALENDAR_OWNER_USER_ID is unset, no one gets calendar data.
function getCalendarOwnerId(): string | null {
  const raw = process.env.CALENDAR_OWNER_USER_ID;
  if (!raw) return null;
  const trimmed = raw.trim();
  return trimmed.length > 0 ? trimmed : null;
}

router.get("/calendar/upcoming", requireAuth, async (req, res): Promise<void> => {
  const ownerId = getCalendarOwnerId();
  if (!ownerId || req.user!.id !== ownerId) {
    res.status(403).json({ error: "calendar_not_available" });
    return;
  }
  try {
    const events = await fetchUpcomingEvents(3);
    res.json(events);
  } catch (err) {
    req.log.error({ err }, "Failed to fetch Google Calendar events");
    res.status(502).json({ error: "Unable to load calendar events" });
  }
});

export default router;
