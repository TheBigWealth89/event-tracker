import { Request, Response, NextFunction } from "express";
import logger from "../utils/logger";

/**
 * API Key Authentication Middleware
 *
 * Reads the `x-api-key` header and validates it against the comma-separated
 * list of keys in the `API_KEYS` environment variable.
 *
 * Returns:
 *  - 401 if the header is missing
 *  - 403 if the key is present but not in the allowed list
 */
export function apiKey(req: Request, res: Response, next: NextFunction): void {
  const key = req.headers["x-api-key"];

  if (!key || typeof key !== "string") {
    res.status(401).json({ success: false, message: "API key is required." });
    return;
  }

  console.log("key", key);

  const validKeys = (process.env.API_KEYS ?? "")
    .split(",")
    .map((k) => k.trim())
    .filter(Boolean);
  console.log("process.env.API_KEYS", validKeys);
  if (!validKeys.includes(key)) {
    logger.warn("Invalid API key attempt", { ip: req.ip });
    res.status(403).json({ success: false, message: "Invalid API key." });
    return;
  }

  next();
}
