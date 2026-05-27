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

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(morningLogsRouter);
router.use(bodyScansRouter);
router.use(eveningReportsRouter);
router.use(habitsRouter);
router.use(dashboardRouter);
router.use(affirmationsRouter);
router.use(calendarRouter);
router.use(profileRouter);
router.use(chatRouter);

export default router;
