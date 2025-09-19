import "../config/loadEnv";
import { redisClient, connectAll } from "../db/connection";
import logger from "../utils/logger";

const processEvent = async () => {
  const BATCH_SEIZE = 100;

  try {
    const eventsAsStrings = await redisClient.lrange("events", 0, BATCH_SEIZE -1);

    if (eventsAsStrings.length === 0) {
      return;
    }

    logger.info(`Processing a batch of ${eventsAsStrings.length}`);

    const eventCount = eventsAsStrings.reduce<Record<string, number>>(
      (acc, eventString) => {
        try {
          const event = JSON.parse(eventString) as { eventName: string };
          acc[event.eventName] = acc[event.eventName || 0] + 1;
        } catch (err) {
          logger.error("Failed to parse event from Redis", eventString);
        }
        return acc;
      },
      {}
    );

    logger.info("Aggregated event counts", eventCount);

    await redisClient.ltrim("events", eventsAsStrings.length, -1);
  } catch (err) {
    logger.error("Error in worker", err);
  }
};

async function startWorker() {
  await connectAll();
  logger.info(
    "🚀 Polling worker started. Checking for events every 5 seconds."
  );
  setInterval(processEvent, 5000);
}

startWorker();
