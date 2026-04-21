import { createServer } from "http";
import { initSocket, closeSocket } from "./sockets";
import express, { Request, Response, NextFunction } from "express";
import { connectAll, pool, redisClient } from "./db/connection";
import trackRouter from "./router/eventTracker";
import { ZodError } from "zod";
import logger from "./utils/logger";
import path from "path";
import { buildPrometheusText } from "./utils/metrics";

const app = express();

app.use(express.json());

const PORT = Number(process.env.PORT) || 5000;
const httpServer = createServer(app);
initSocket(httpServer);

app.use(express.static(path.join(__dirname, "public")));

// Health checks
app.get("/health", async (_req: Request, res: Response) => {
  let isHealthy = true;

  // Postgres check
  let pgStatus = "ok";
  let pgLatency = 0;
  try {
    const start = Date.now();
    await pool.query("SELECT 1");
    pgLatency = Date.now() - start;
  } catch (err) {
    pgStatus = "error";
    isHealthy = false;
    logger.error("Health check - Postgres error", err);
  }

  // Redis check
  let redisStatus = "ok";
  let streamLength = 0;
  try {
    await redisClient.ping();
    streamLength = await redisClient.xlen("events");
  } catch (err) {
    redisStatus = "error";
    isHealthy = false;
    logger.error("Health check - Redis error", err);
  }

  // Worker check
  let workerLagSeconds = 0;
  let workerEventsTotal = 0;
  let workerLastProcessedAt: string | null = null;
  let workerHeartbeatLagSeconds = 0;
  let hasUnprocessedEvents = false;
  try {
    // 1. Check Heartbeat (Liveness)
    const heartbeatStr = await redisClient.get("worker:heartbeat");
    if (heartbeatStr) {
      const lastHeartbeat = new Date(heartbeatStr).getTime();
      workerHeartbeatLagSeconds = Math.max(0, (Date.now() - lastHeartbeat) / 1000);
    } else {
      workerHeartbeatLagSeconds = 999999; // Never seen
    }

    // 2. Check Throughput/Lag
    const lastProcessedAtStr = await redisClient.get(
      "worker:last_processed_at"
    );
    if (lastProcessedAtStr) {
      workerLastProcessedAt = lastProcessedAtStr;
      const lastProcessedAt = new Date(lastProcessedAtStr).getTime();
      workerLagSeconds = Math.max(0, (Date.now() - lastProcessedAt) / 1000);
    }
    const totalEventsStr = await redisClient.get(
      "worker:events_processed_total"
    );
    if (totalEventsStr) {
      workerEventsTotal = parseInt(totalEventsStr, 10);
      if (isNaN(workerEventsTotal)) workerEventsTotal = 0;
    }

    // 3. Check if there are actual unprocessed events waiting
    const workerBookmark = (await redisClient.get("analytics_worker:last_id")) || "0-0";
    const pendingEvents = await redisClient.xread("COUNT", 1, "STREAMS", "events", workerBookmark);
    if (pendingEvents && pendingEvents.length > 0) {
      const [, entries] = pendingEvents[0];
      if (entries && entries.length > 0) {
        hasUnprocessedEvents = true;
      }
    }
  } catch (err) {
    logger.error("Health check - Worker state error", err);
  }

  // Final Health Decision
  // A. If worker process is offline (heartbeat stale) -> Unhealthy
  if (workerHeartbeatLagSeconds > 30) {
    isHealthy = false;
  }

  // B. If worker is alive but behind (> 40s) AND there are events waiting -> Unhealthy
  if (workerLagSeconds > 40 && hasUnprocessedEvents) {
    isHealthy = false;
  }

  const memory = process.memoryUsage();

  const healthData = {
    status: isHealthy ? "ok" : "degraded",
    timestamp: new Date().toISOString(),
    uptime_seconds: process.uptime(),
    memory: {
      rss_mb: Math.max(1, Math.round(memory.rss / 1024 / 1024)),
      heap_used_mb: Math.max(1, Math.round(memory.heapUsed / 1024 / 1024)),
    },
    postgres: {
      status: pgStatus,
      latency_ms: pgLatency,
    },
    redis: {
      status: redisStatus,
      stream_length: streamLength,
    },
    worker: {
      status: workerHeartbeatLagSeconds > 30 ? "offline" : "online",
      heartbeat_lag_seconds: Number(workerHeartbeatLagSeconds.toFixed(2)),
      last_processed_at: workerLastProcessedAt,
      lag_seconds: Number(workerLagSeconds.toFixed(2)),
      events_processed_total: workerEventsTotal,
    },
  };

  res.status(isHealthy ? 200 : 503).json(healthData);
});

app.get("/metrics", async (_req: Request, res: Response) => {
  try {
    const metricsStr = await buildPrometheusText();
    res.set("Content-Type", "text/plain; version=0.0.4");
    res.send(metricsStr);
  } catch (err) {
    logger.error("Metrics endpoint error", err);
    res.status(500).send("Error building metrics");
  }
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
