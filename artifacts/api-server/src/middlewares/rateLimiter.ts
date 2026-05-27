import rateLimit, { ipKeyGenerator } from "express-rate-limit";
import type { Request } from "express";

function keyByUserOrIp(req: Request): string {
  if (req.user?.id) {
    return `user:${req.user.id}`;
  }
  return `ip:${ipKeyGenerator(req.ip ?? "unknown")}`;
}

export const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 300,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  keyGenerator: keyByUserOrIp,
  message: { error: "Too many requests, please try again later." },
  skip: (req) => req.method === "GET" && req.path.startsWith("/api/healthz"),
});

export const writeLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 60,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  keyGenerator: keyByUserOrIp,
  message: { error: "Too many write requests, please slow down." },
});
