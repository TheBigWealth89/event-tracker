import express, { Request, Response } from "express";
import { validate } from "../middleware/validation.middleware";
import { trackEventSchema, TrackEventInput } from "../schema/eventSchema";
import { redisClient } from "../db/connection";
import logger from "../utils/logger";

const route = express.Router();
route.post(
  "/track",
  validate(trackEventSchema),
  async (req: Request<object, object, TrackEventInput>, res: Response) => {
    const eventPayload = req.body;
    try {
      const res1 = await redisClient.xadd(
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
      logger.info("ID's", res1);
      console.log(res1);
      res.status(200).json({
        success: true,
        event: eventPayload,
      });
    } catch (err) {
      logger.error("Failed to track event", err);
      res.status(500).json({
        success: false,
        message: "Failed to track event"
      });
    }
  }
);

export default route;