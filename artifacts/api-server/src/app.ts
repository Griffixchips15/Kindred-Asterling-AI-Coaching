import express, { type Express } from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import helmet from "helmet";
import pinoHttp from "pino-http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { authMiddleware } from "./middlewares/authMiddleware";
import { generalLimiter, writeLimiter } from "./middlewares/rateLimiter";
import router from "./routes";
import { authLimiter } from "./middlewares/rateLimiter";
import { logger } from "./lib/logger";

const app: Express = express();

const allowedOrigins = new Set(
  [
    process.env.APP_PUBLIC_URL,
    "http://localhost:4000",
    "http://127.0.0.1:4000",
    process.env.RAILWAY_PUBLIC_DOMAIN
      ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN}`
      : undefined,
    ...(process.env.REPLIT_DOMAINS || "")
      .split(",")
      .filter(Boolean)
      .map((domain) => `https://${domain.trim()}`),
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
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      frameAncestors: ["'none'"],
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
app.use(cookieParser());
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
app.use(authMiddleware);
app.use(generalLimiter);
app.use((req, res, next) => {
  const writeMethods = ["POST", "PUT", "PATCH", "DELETE"];
  if (writeMethods.includes(req.method)) {
    writeLimiter(req, res, next);
  } else {
    next();
  }
});

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
