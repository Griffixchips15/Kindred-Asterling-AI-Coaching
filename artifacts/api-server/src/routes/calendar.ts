import { Router, type IRouter } from "express";
import { requireAuth } from "../middlewares/requireAuth";
import {
  createOAuthState,
  fetchUpcomingEvents,
  googleAuthorizationUrl,
  hasCalendarConnection,
  isCalendarConfigured,
  saveAuthorizationCode,
  verifyOAuthState,
} from "../lib/googleCalendar";

const router: IRouter = Router();

router.get("/calendar/status", requireAuth, async (req, res): Promise<void> => {
  res.json({ configured: isCalendarConfigured(), connected: await hasCalendarConnection(req.user!.id) });
});

router.get("/calendar/connect", requireAuth, (req, res): void => {
  if (!isCalendarConfigured()) {
    res.status(503).json({ error: "calendar_not_configured" });
    return;
  }
  res.json({ url: googleAuthorizationUrl(createOAuthState(req.user!.id)) });
});

router.get("/calendar/callback", async (req, res): Promise<void> => {
  const redirect = `${process.env.APP_PUBLIC_URL || ""}/app/calendar`;
  try {
    const state = typeof req.query.state === "string" ? req.query.state : "";
    const code = typeof req.query.code === "string" ? req.query.code : "";
    if (!state || !code) throw new Error("Missing Google OAuth response");
    await saveAuthorizationCode(verifyOAuthState(state), code);
    res.redirect(`${redirect}?connected=1`);
  } catch (err) {
    req.log.error({ err }, "Google Calendar OAuth callback failed");
    res.redirect(`${redirect}?error=connect_failed`);
  }
});

router.get("/calendar/upcoming", requireAuth, async (req, res): Promise<void> => {
  if (!isCalendarConfigured()) {
    res.status(503).json({ error: "calendar_not_configured" });
    return;
  }
  if (!(await hasCalendarConnection(req.user!.id))) {
    res.status(409).json({ error: "calendar_not_connected" });
    return;
  }
  try {
    const events = await fetchUpcomingEvents(req.user!.id, 3);
    res.json(events);
  } catch (err) {
    req.log.error({ err }, "Failed to fetch Google Calendar events");
    res.status(502).json({ error: "Unable to load calendar events" });
  }
});

export default router;
