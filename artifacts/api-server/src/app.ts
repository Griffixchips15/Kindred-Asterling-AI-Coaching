import express, { type Express } from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import pinoHttp from "pino-http";
import { authMiddleware } from "./middlewares/authMiddleware";
import { generalLimiter, writeLimiter } from "./middlewares/rateLimiter";
import router from "./routes";
import { logger } from "./lib/logger";

const app: Express = express();

const allowedOrigins = new Set([
  "https://allowed1.com",
  "https://allowed2.com",
]);

app.set("trust proxy", 1);

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
      if (!origin || allowedOrigins.has(origin)) {
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
      // Preserve the raw body so the Square webhook route can verify its HMAC
      // signature over the exact bytes Square sent.
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

export default app;
