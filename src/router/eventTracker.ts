import express, { Request, Response } from "express";
import { validate } from "../middleware/validation.middleware";
import { trackEventSchema, TrackEventInput } from "../schema/eventSchema";
import { redisClient } from "../db/connection";
import logger from "../utils/logger";

const route = express.Router();
route.post(
  "/track"
  validate(trackEventSchema),
  async (req: Request<{}, {}, TrackEventInput>, res: Response)  {
    const eventPayload = req.body;
    console.log("PayLoad coming:", eventPayload);
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
  
      res.status(200).json({
        success: true,
        event: eventPayload,
      });
    } catch (err) {}
  }
);

export default route;
