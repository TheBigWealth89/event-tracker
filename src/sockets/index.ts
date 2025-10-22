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

const subscriber = redisClient.duplicate();

async function setupPubSub() {
  subscriber.on("message", (channel, message) => {
    try {
      logger.info(`📨 Received message on ${channel}`);
      const parsed = JSON.parse(message);
      logger.info("Successfully Received:", parsed);
      if (io) io.emit("analytics-update", parsed);
    } catch (err) {
      logger.error("Error handling analytics update:", err);
    }
  });

  await subscriber.subscribe("analytics-update");
  logger.info("✅ Subscribed to analytics-update");
}

setupPubSub().catch(console.error);
