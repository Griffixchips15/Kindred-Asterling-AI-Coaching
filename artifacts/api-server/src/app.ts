import express, { type Express } from "express";
import cors from "cors";
import helmet from "helmet";
import pinoHttp from "pino-http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createClerkClient } from "@clerk/clerk-sdk-node";
import { authMiddleware } from "./middlewares/authMiddleware";
import { sessionAuthMiddleware } from "./middlewares/sessionAuthMiddleware";
import { generalLimiter, writeLimiter } from "./middlewares/rateLimiter";
import router from "./routes";
import { logger } from "./lib/logger";

const app: Express = express();

const clerkOrigins = [
  "https://clerk.kindred-asterling-ai-coaching.com",
  "https://accounts.kindred-asterling-ai-coaching.com",
];

const allowedOrigins = new Set(
  [
    process.env.APP_PUBLIC_URL,
    process.env.APP_PUBLIC_URL?.replace("://", "://www."),
    "http://localhost:4000",
    "http://127.0.0.1:4000",
    "http://localhost:8080",
    "http://127.0.0.1:8080",
  ]
    .filter((origin): origin is string => Boolean(origin))
    .map((origin) => origin.replace(/\/$/, "")),
);

app.set("trust proxy", 1);

// Security headers — Helmet sets CSP, X-Frame-Options, HSTS, etc.
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", clerkOrigins[0], "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", "https://*.clerk.com", ...clerkOrigins],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      objectSrc: ["'none'"],
      frameAncestors: ["'none'"],
      frameSrc: ["https://*.clerk.com", ...clerkOrigins],
      workerSrc: ["'self'", "blob:"],
    },
  },
  crossOriginEmbedderPolicy: false, // Allow audio/TTS resources
}));

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
app.use(
  cors({
    credentials: true,
    origin: (origin, callback) => {
      // Allow requests with no origin (same-origin, curl, server-to-server)
      // and any localhost origin (for local dev on any port).
      if (
        !origin ||
        allowedOrigins.has(origin.replace(/\/$/, "")) ||
        /^https?:\/\/localhost(:\d+)?$/i.test(origin)
      ) {
        callback(null, true);
        return;
      }
      callback(new Error("Not allowed by CORS"));
    },
  }),
);
app.use(
  express.json({
    limit: "32kb",
    verify: (req, _res, buf) => {
  // Preserve the raw body so the Helcim webhook route can verify its HMAC
  // signature over the exact bytes Helcim sent.
      (req as unknown as { rawBody?: Buffer }).rawBody = buf;
    },
  }),
);
app.use(express.urlencoded({ extended: true, limit: "32kb" }));

// In test mode, use the legacy session-based auth (tests create sessions directly).
// In dev/production, use Clerk's JWT-based auth.
const isTest = process.env.NODE_ENV === "test" || process.env.VITEST === "true";
if (isTest) {
  app.use(sessionAuthMiddleware);
} else {
  const clerkClient = createClerkClient({
    secretKey: process.env.CLERK_SECRET_KEY!,
    publishableKey: process.env.CLERK_PUBLISHABLE_KEY!,
  });
  app.use(clerkClient.expressWithAuth());
  // TEMPORARY DEBUG: capture Clerk's exact token rejection reason.
  app.use(async (req, _res, next) => {
    if (req.path.startsWith("/api") && req.path !== "/api/healthz") {
      try {
        const headers = new Headers();
        for (const [name, value] of Object.entries(req.headers)) {
          if (typeof value === "string") headers.set(name, value);
          else if (Array.isArray(value)) headers.set(name, value.join(","));
        }
        const request = new Request(
          new URL(req.originalUrl || req.url, `${req.protocol}://${req.get("host")}`),
          { method: req.method, headers },
        );
        const state = await clerkClient.authenticateRequest(request);
        logger.info(
          { url: req.path, clerkDebug: clerkClient.debugRequestState(state) },
          "clerk-verification-debug",
        );
      } catch (err) {
        logger.warn({ err, url: req.path }, "clerk-verification-debug-error");
      }
    }
    next();
  });
  app.use(authMiddleware);
}

// TEMPORARY DEBUG: log Clerk auth state for failed requests
app.use((req, res, next) => {
  if (req.path.startsWith("/api") && req.path !== "/api/healthz") {
    const auth = (req as unknown as { auth?: { userId?: string | null; sessionId?: string | null } }).auth;
    const authHeader = req.headers.authorization;
    logger.info(
      {
        url: req.path,
        method: req.method,
        authUserId: auth?.userId ?? null,
        authSessionId: auth?.sessionId ?? null,
        hasAuthHeader: Boolean(authHeader),
        authHeaderPrefix: authHeader ? authHeader.slice(0, 20) : null,
      },
      "clerk-auth-debug",
    );
  }
  next();
});

app.use(generalLimiter);
app.use((req, res, next) => {
  const writeMethods = ["POST", "PUT", "PATCH", "DELETE"];
  if (writeMethods.includes(req.method)) {
    writeLimiter(req, res, next);
  } else {
    next();
  }
});

// Password reset — must be accessible without auth; placed before the main
// router to avoid hitting requireAuth inside the router stack.
app.use("/api", router);

if (process.env.NODE_ENV === "production") {
  const serverDir = path.dirname(fileURLToPath(import.meta.url));
  const publicDir = path.resolve(
    serverDir,
    "../../kindred-coach/dist/public",
  );

  app.use(express.static(publicDir));
  app.get(/^(?!\/api(?:\/|$)).*/, (_req, res) => {
    res.sendFile(path.join(publicDir, "index.html"));
  });
}

export default app;
