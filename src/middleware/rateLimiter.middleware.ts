import rateLimit from "express-rate-limit";

/**
 * Tight rate limiter for write endpoints (e.g. POST /track).
 * 30 requests per minute per IP.
 */
export const writeLimiter = rateLimit({
  windowMs: Number(process.env.RATE_LIMIT_WRITE_WINDOW_MS) || 60 * 1000, // 1 minute default
  max: Number(process.env.RATE_LIMIT_WRITE_MAX) || 30, // 30 req/min default
  standardHeaders: true, // Return rate limit info in `RateLimit-*` headers
  legacyHeaders: false,
  message: {
    success: false,
    message: "Too many requests. Please slow down and try again later.",
  },
});

/**
 * Loose baseline rate limiter applied globally.
 * 30 requests per 10 minutes per IP.
 */
export const globalLimiter = rateLimit({
  windowMs: Number(process.env.RATE_LIMIT_GLOBAL_WINDOW_MS) || 10 * 60 * 1000, // 10 minutes default
  max: Number(process.env.RATE_LIMIT_GLOBAL_MAX) || 30, // 30 req/10min default
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: "Too many requests from this IP. Please try again later.",
  },
});
