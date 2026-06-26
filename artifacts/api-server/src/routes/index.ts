import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import morningLogsRouter from "./morningLogs";
import bodyScansRouter from "./bodyScans";
import eveningReportsRouter from "./eveningReports";
import habitsRouter from "./habits";
import dashboardRouter from "./dashboard";
import affirmationsRouter from "./affirmations";
import calendarRouter from "./calendar";
import profileRouter from "./profile";
import chatRouter from "./chat";
import medicationsRouter from "./medications";
import weeklyReportRouter from "./weeklyReport";
import subscriptionRouter from "./subscription";
import voiceRouter from "./voice";
import remindersRouter from "./reminders";
import { requireAuth } from "../middlewares/requireAuth";
import { requireSubscription } from "../middlewares/requireSubscription";

const router: IRouter = Router();

// Open routes: health, auth, and the subscription status/webhook endpoints.
router.use(healthRouter);
router.use(authRouter);
router.use(subscriptionRouter);

// Everything below requires an authenticated user with an active subscription.
router.use(requireAuth);
router.use(requireSubscription);

router.use(morningLogsRouter);
router.use(bodyScansRouter);
router.use(eveningReportsRouter);
router.use(habitsRouter);
router.use(dashboardRouter);
router.use(affirmationsRouter);
router.use(calendarRouter);
router.use(profileRouter);
router.use(chatRouter);
router.use(medicationsRouter);
router.use(weeklyReportRouter);
router.use(voiceRouter);
router.use(remindersRouter);

export default router;
