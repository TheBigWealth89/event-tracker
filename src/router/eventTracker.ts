import express, { Request, Response } from "express";
import { validate } from "../middleware/validation.middleware";
import { trackEventSchema, TrackEventInput } from "../schema/eventSchema";
import { redisClient } from "../db/connection";
import logger from "../utils/logger";

const route = express.Router();

const AGGREGATION_KEY = "analytics:event_counts";
route.get("/", async (req, res) => {
  try {
    const eventCounts = await redisClient.hgetall(AGGREGATION_KEY);

    // Convert the flat object from Redis into an array of objects for EJS
    const events = Object.entries(eventCounts).map(([eventName, count]) => ({
      name: eventName,
      count: parseInt(count, 10),
    }));

    res.render("dashboard", { events });
  } catch (err) {
    logger.error("Failed to load dashboard:", err);
    res.status(500).send("Error loading dashboard.");
  }
});

route.post(
  "/track",
  validate(trackEventSchema),
  async (req: Request<object, object, TrackEventInput>, res: Response) => {
    const eventPayload = req.body;
    try {
      await redisClient.xadd(
        "events",
        "*",
        "userId",
        eventPayload.userId ?? "",
        "eventName",
        eventPayload.eventName ?? "",
        "url",
        eventPayload.url ?? "",
        "metadata",
        JSON.stringify(eventPayload.metadata ?? {})
      );
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
