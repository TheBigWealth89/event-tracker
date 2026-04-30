import express, { Request, Response } from "express";
import { validate } from "../middleware/validation.middleware";
import { apiKey } from "../middleware/apiKey.middleware";
import { writeLimiter } from "../middleware/rateLimiter.middleware";
import { trackEventSchema, TrackEventInput } from "../schema/eventSchema";
import { redisClient, pool } from "../db/connection";
import logger from "../utils/logger";

const route = express.Router();
// Redis key for aggregated event counts
const AGGREGATION_KEY = "analytics:event_counts";

import path from "path";

route.get("/dashboard", (req, res) => {
  res.sendFile(path.join(__dirname, "../public/index.html"));
});

/**
 * GET /api/stats
 * Fetches current aggregated event counts from Redis
 */
route.get("/api/stats", async (req, res) => {
  try {
    const eventCounts = await redisClient.hgetall(AGGREGATION_KEY);
    res.status(200).json({ success: true, data: eventCounts });
  } catch (err) {
    logger.error("Failed to load stats:", err);
    res.status(500).json({ success: false, message: "Error loading stats." });
  }
});

/**
 * GET /analytics?range=1h
 * Fetches historical event trends from TimescaleDB
 */
route.get("/analytics", async (req: Request, res: Response) => {
  try {
    const range = (req.query.range as string) || "1h";

    // Simple mapping of shorthand ranges to SQL intervals
    const intervalMap: Record<string, string> = {
      "1h": "1 hour",
      "6h": "6 hours",
      "24h": "24 hours",
      "7d": "7 days",
    };

    const sqlInterval = intervalMap[range] || "1 hour";

    const query = `
      SELECT 
        time_bucket('1 minute', bucket) AS interval, 
        event_name, 
        SUM(count) as count
      FROM event_counts
      WHERE bucket > NOW() - $1::interval
      GROUP BY interval, event_name
      ORDER BY interval DESC, event_name;
    `;

    const result = await pool.query(query, [sqlInterval]);

    res.status(200).json({
      success: true,
      range,
      data: result.rows,
    });
  } catch (err) {
    logger.error("Failed to fetch analytics:", err);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
});

route.post(
  "/track",
  apiKey,
  writeLimiter,
  validate(trackEventSchema), // validation middleware
  async (req: Request<object, object, TrackEventInput>, res: Response) => {
    // event payload from the request body
    const eventPayload = req.body;
    const maxLen = Number(process.env.REDIS_STREAM_MAX_LENGTH) || 50000;

    try {
      await redisClient.xadd(
        "events", // Redis stream key
        "MAXLEN",
        "~",
        maxLen,
        "*", // Auto-generate ID
        "userId",
        eventPayload.userId ?? "",
        "eventName",
        eventPayload.eventName ?? "",
        "url",
        eventPayload.url ?? "",
        "metadata",
        JSON.stringify(eventPayload.metadata ?? {})
      );
      logger.info("Event tracked successfully", eventPayload);
      res.status(200).json({
        success: true,
        event: eventPayload,
      });
    } catch (err) {
      logger.error("Failed to track event", err);
      res.status(500).json({
        success: false,
        message: "Failed to track event",
      });
    }
  }
);

export default route;
