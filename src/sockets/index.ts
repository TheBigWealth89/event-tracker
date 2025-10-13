import { Server } from "socket.io";
import logger from "../utils/logger";
import { Server as HTTPServer } from "http";
import { redisClient } from "../db/connection";

let io: Server | null = null;

export const initSocket = (httpServer: HTTPServer) => {
  io = new Server(httpServer, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"],
    },
  });

  io.on("connection", (socket) => {
    logger.info(`Socket connected: ${socket.id}`);

    socket.on("disconnect", (reason) => {
      logger.info(`Socket disconnected: ${socket.id} (${reason})`);
    });
  });
};

//Create thr redis subscriber
const subscriber = redisClient.duplicate();

async function setupPubSub() {
  await subscriber.subscribe("analytics-updates");
  // Subscribe to the channel that your worker will publish to
  subscriber.on("message", (message: string, channel: string) => {
    try {
      logger.info(`Received analytics update from ${channel}`);
      const parsed = JSON.parse(message);
      if (io) io.emit("analytics-update", parsed);
    } catch (err) {
      logger.error("Error handling analytics update:", err);
    }
  });
}
setupPubSub();
