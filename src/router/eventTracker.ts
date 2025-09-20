import express, { Request, Response } from "express";
import { validate } from "../middleware/validation.middleware";
import { trackEventSchema, TrackEventInput } from "../schema/eventSchema";
import { redisClient } from "../db/connection";
const route = express.Router();

route.post(
  "/track",
  validate(trackEventSchema),
  (req: Request<{}, {}, TrackEventInput>, res: Response) => {
    const eventPayload = JSON.stringify(req.body);

    redisClient.lpush("events", eventPayload);

    res.status(200).json({
      success: true,
      event: eventPayload,
    });
  }
);

export default route;
