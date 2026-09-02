import express, { type Express } from "express";
import cors from "cors";
import helmet from "helmet";
import pinoHttp from "pino-http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { clerkMiddleware } from "@clerk/express";
import { authMiddleware } from "./middlewares/authMiddleware";
import { testClerkIdentityAdapter } from "./middlewares/testClerkIdentityAdapter";
import { generalLimiter, writeLimiter } from "./middlewares/rateLimiter";
import router from "./routes";
import healthRouter from "./routes/health";
import { logger } from "./lib/logger";
import * as Sentry from "@sentry/node";

const app: Express = express();

// Health routes must respond without Clerk credentials (used in CI/verification
// environments where Clerk keys may not be configured).
app.use("/api", healthRouter);

// Clerk must authenticate the untouched incoming request before any middleware
// that may transform it. Tests use an isolated identity adapter instead.
const isTest = process.env.NODE_ENV === "test" || process.env.VITEST === "true";
if (!isTest) {
  app.use(
    clerkMiddleware({
      secretKey: process.env.CLERK_SECRET_KEY!,
      publishableKey: process.env.CLERK_PUBLISHABLE_KEY!,
    }),
  );
}

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

const trustedProxyHops = Number.parseInt(
  process.env.TRUST_PROXY_HOPS ?? "1",
  10,
);
app.set(
  "trust proxy",
  Number.isFinite(trustedProxyHops) ? trustedProxyHops : 1,
);

// Security headers — Helmet sets CSP, X-Frame-Options, HSTS, etc.
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", clerkOrigins[0], "'unsafe-inline'"],
        styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
        imgSrc: ["'self'", "data:", "https:"],
        connectSrc: [
          "'self'",
          "https://*.clerk.com",
          "https://*.ingest.sentry.io",
          "https://*.ingest.us.sentry.io",
          ...clerkOrigins,
        ],
        fontSrc: ["'self'", "https://fonts.gstatic.com"],
        objectSrc: ["'none'"],
        frameAncestors: ["'none'"],
        frameSrc: ["https://*.clerk.com", ...clerkOrigins],
        workerSrc: ["'self'", "blob:"],
      },
    },
    crossOriginEmbedderPolicy: false, // Allow audio/TTS resources
  }),
);

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

// Tests use a deliberately small Clerk identity stand-in, never production session code.
if (isTest) {
  app.use(testClerkIdentityAdapter);
} else {
  app.use(authMiddleware);
}

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
  const publicDir = path.resolve(serverDir, "../../kindred-coach/dist/public");

  app.use(express.static(publicDir));
  app.get(/^(?!\/api(?:\/|$)).*/, (_req, res) => {
    res.sendFile(path.join(publicDir, "index.html"));
  });
}

// This must be registered after every controller and static route so Sentry can
// observe errors passed through Express without changing normal responses.
Sentry.setupExpressErrorHandler(app);

export default app;
