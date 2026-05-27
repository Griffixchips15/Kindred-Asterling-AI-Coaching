import { Router, type IRouter } from "express";
import { requireAuth } from "../middlewares/requireAuth";
import { fetchUpcomingEvents } from "../lib/googleCalendar";

const router: IRouter = Router();

router.get("/calendar/upcoming", requireAuth, async (req, res): Promise<void> => {
  try {
    const events = await fetchUpcomingEvents(3);
    res.json(events);
  } catch (err) {
    req.log.error({ err }, "Failed to fetch Google Calendar events");
    res.status(502).json({ error: "Unable to load calendar events" });
  }
});

export default router;
