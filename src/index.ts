import { createServer } from "http";
import { initSocket, closeSocket } from "./sockets";
import express, { Request, Response, NextFunction } from "express";
import { connectAll, pool, redisClient } from "./db/connection";
import trackRouter from "./router/eventTracker";
import { ZodError } from "zod";
import logger from "./utils/logger";
import path from "path";

const app = express();

app.use(express.json());

const PORT = Number(process.env.PORT) || 5000;
const httpServer = createServer(app);
initSocket(httpServer);

app.use(express.static(path.join(__dirname, "public")));
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

// Health checks
app.get("/health", (_req: Request, res: Response) => {
  res.status(200).json({ status: "ok", timestamp: new Date().toISOString() });
});

app.use("/", trackRouter);

// Error handling middleware must be registered after routes and have 4 args
// eslint-disable-next-line @typescript-eslint/no-unused-vars
app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  if (err instanceof ZodError) {
    const { fieldErrors } = err.flatten();
    return res.status(400).json({ errors: fieldErrors });
  }

  logger.error("Unhandled error:", err instanceof Error ? err.message : err);
  res.status(500).json({ message: "Internal server error" });
});

let isShuttingDown = false;

async function gracefulShutdown(signal: string) {
  if (isShuttingDown) return;
  isShuttingDown = true;

  logger.info(`Received ${signal}. Starting graceful shutdown...`);

  // 1. Stop accepting new HTTP requests
  httpServer.close(async (err) => {
    if (err) {
      logger.error("Error closing HTTP server:", err);
      process.exit(1);
    }
    logger.info("HTTP server closed.");

    try {
      // 2. Close Sockets and their Redis subscriber
      await closeSocket();

      // 3. Close Shared Redis client
      logger.info("Closing main Redis client...");
      await redisClient.quit();

      // 4. Close Postgres Pool
      logger.info("Closing PostgreSQL pool...");
      await pool.end();

      logger.info("Graceful shutdown complete. Exiting.");
      process.exit(0);
    } catch (error) {
      logger.error("Error during graceful shutdown:", error);
      process.exit(1);
    }
  });

  // Failsafe: force exit after 10 seconds
  setTimeout(() => {
    logger.error("Graceful shutdown timed out. Forcing exit.");
    process.exit(1);
  }, 10000).unref();
}

process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("SIGINT", () => gracefulShutdown("SIGINT"));

(async () => {
  try {
    await connectAll();

    httpServer.listen(PORT, "0.0.0.0", () => {
      logger.info(
        `🚀 Server with Socket.IO is running on http://0.0.0.0:${PORT}`
      );
    });
  } catch (err) {
    logger.error("Failed to start server", err);
    process.exit(1);
  }
})();
