import rateLimit from "express-rate-limit";

/**
 * Tight rate limiter for write endpoints (e.g. POST /track).
 * 30 requests per minute per IP.
 */
export const writeLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 30,
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
  windowMs: 10 * 60 * 1000, // 10 minutes
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: "Too many requests from this IP. Please try again later.",
  },
});
