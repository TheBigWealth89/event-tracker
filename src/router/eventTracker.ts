import express, { Request, Response } from "express";
import { redisClient } from "../db/connection";
const route = express.Router();

route.post("/track", (req: Request, res: Response) => {
  const eventPayload = JSON.stringify(req.body);
  redisClient.lpush("events", eventPayload);

  res.status(200).json({
    success: true,
    event: eventPayload,
  });
});

export default route;
