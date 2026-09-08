import { Router, type IRouter } from "express";
import { requireAuth } from "../middlewares/requireAuth";
import {
  disconnectCalendar,
  hasCalendarConnection,
} from "../lib/googleCalendar";

const router: IRouter = Router();

// Keep status and withdrawal available for people with previously saved access.
router.get("/calendar/status", requireAuth, async (req, res): Promise<void> => {
  res.json({
    retired: true,
    configured: false,
    connected: await hasCalendarConnection(req.user!.id),
  });
});

router.delete(
  "/calendar/connection",
  requireAuth,
  async (req, res): Promise<void> => {
    await disconnectCalendar(req.user!.id);
    res.status(204).end();
  },
);

// Old clients receive an explicit terminal response; never request Google data.
router.get(
  ["/calendar/connect", "/calendar/upcoming"],
  requireAuth,
  (_req, res): void => {
    res.status(410).json({ error: "calendar_retired" });
  },
);

// An OAuth flow started before the sunset must not exchange or store its code.
router.get("/calendar/callback", (_req, res): void => {
  const origin = (process.env.APP_PUBLIC_URL || "").replace(/\/+$/, "");
  res.redirect(`${origin}/app/calendar?retired=1`);
});

export default router;
