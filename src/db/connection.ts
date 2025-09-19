
import "../config/loadEnv"
import Redis from "ioredis";
import logger from "../utils/logger";
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

redisClient.on("connect", () =>
  logger.info(`Redis connecting......... ${redisUrl}`)
);
redisClient.on("ready", () => logger.info("Redis client ready"));
redisClient.on("error", (err: Error) => logger.error("Redis error:", err));
redisClient.on("end", () => logger.warn("Redis connection closed"));

// --- Central Connect Function ---
let isConnected = false;
export async function connectAll(): Promise<void> {
  if (isConnected) return; // Prevent connecting multiple times

  try {
    logger.info("🚀 Initializing all connections...");
    //Checking status because ioredis connects automatically
    if (redisClient.status !== "ready") {
      logger.info("⏳ Waiting for Redis connection...");
    }
    logger.info("✅ Redis connected.");
    isConnected = true;
  } catch (err) {
    isConnected = false;
    throw err;
  }
}
