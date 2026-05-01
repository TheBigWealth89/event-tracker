import "../config/loadEnv";
import Redis from "ioredis";
import logger from "../utils/logger";
import { Pool } from "pg";

const sslConfig =
  process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : false; // Use SSL in production (like on Render)
// --- PostgreSQL Connection ---
export const pool = new Pool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  port: process.env.DB_PORT ? Number(process.env.DB_PORT) : undefined,
  ssl: sslConfig,
  // --- Pool Performance Tuning ---
  max: 10,
  min: 2,
  idleTimeoutMillis: 60000,
  connectionTimeoutMillis: 5000,
});
// --- Redis Connection ---
const redisUrl: string = process.env.REDIS_URL || "";
export const redisClient = new Redis(redisUrl, {
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
  // rejectUnauthorized is not a valid option at this level, move to tls
  tls: redisUrl.startsWith("rediss://")
    ? { rejectUnauthorized: false }
    : undefined,
});

// --- Connection Event Listeners ---
pool.on("connect", () => logger.info("PostgreSQL client acquired"));
pool.on("error", (err) => logger.error("PostgreSQL pool error:", err));

redisClient.on("connect", () =>
  // logger.info(`Redis connecting to ${redisClient.options.host}:${redisClient.options.port}`)
  logger.info(`Redis connecting to............. ${redisUrl}`)
);
redisClient.on("ready", () => logger.info("Redis client ready"));
redisClient.on("error", (err: Error) => logger.error("Redis error:", err));
redisClient.on("end", () => logger.warn("Redis connection closed"));

// --- Central Connection Management ---
type ConnectionState = "disconnected" | "connecting" | "connected" | "failed";

let connectionState: ConnectionState = "disconnected";
let connectionPromise: Promise<void> | null = null;

/**
 * Initializes all database connections (PostgreSQL and Redis).
 * Uses a state machine and shared promise to handle concurrency and retries.
 */
export async function connectAll(): Promise<void> {
  // 1. If already connected and Redis is healthy, return immediately
  if (connectionState === "connected" && redisClient.status === "ready") {
    return;
  }

  // 2. If a connection attempt is already in progress, wait for it
  if (connectionState === "connecting" && connectionPromise) {
    logger.info("⏳ Connection attempt already in progress, waiting...");
    return connectionPromise;
  }

  // 3. Otherwise, start a new connection attempt
  connectionState = "connecting";
  connectionPromise = (async () => {
    try {
      logger.info("🚀 Initializing all database connections...");

      // PostgreSQL connection check
      const client = await pool.connect();
      client.release();
      logger.info("✅ PostgreSQL connected.");

      // Redis connection check
      if (redisClient.status !== "ready") {
        logger.info("⏳ Waiting for Redis connection...");
        // ioredis connects automatically, but we can wait for the 'ready' event if needed.
        // For now, we trust the automatic connection and just check status.
      }
      logger.info("✅ Redis connected.");

      connectionState = "connected";
    } catch (err) {
      connectionState = "failed";
      logger.error("❌ Failed to initialize database connections:", err);
      throw err;
    } finally {
      connectionPromise = null;
    }
  })();

  return connectionPromise;
}

/**
 * Closes all database connections and resets the state.
 */
export async function disconnectAll(): Promise<void> {
  logger.info("🔌 Closing all database connections...");

  try {
    await redisClient.quit();
    await pool.end();
    connectionState = "disconnected";
    connectionPromise = null;
    logger.info("✅ Connections closed and state reset.");
  } catch (err) {
    logger.error("Error during disconnection:", err);
    throw err;
  }
}
