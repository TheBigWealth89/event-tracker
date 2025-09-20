import { redisClient, connectAll } from "../db/connection";
import logger from "../utils/logger";

const BATCH_SIZE = 100;
const AGGREGATION_KEY = "analytics:event_counts"; // The name of our Redis Hash

async function processEvents() {
  try {
    const eventsAsStrings = await redisClient.lrange(
      "events",
      0,
      BATCH_SIZE - 1
    );

    if (eventsAsStrings.length === 0) {
      return;
    }

    logger.info(`Processing a batch of ${eventsAsStrings.length} events.`);

  
    const batchCounts = eventsAsStrings.reduce<Record<string, number>>(
      (acc, eventString) => {
        try {
          const event = JSON.parse(eventString) as { eventName: string };
          const name = event.eventName || "Unknown";
          acc[name] = (acc[name] || 0) + 1;
        } catch (e) {
          logger.error("Failed to parse event from Redis:", eventString);
        }
        return acc;
      },
      {}
    );

    
    const multi = redisClient.multi();
    for (const [eventName, count] of Object.entries(batchCounts)) {
     
      multi.hincrby(AGGREGATION_KEY, eventName, count);
    }
    await multi.exec();

  
    const grandTotals = await redisClient.hgetall(AGGREGATION_KEY);
    console.log("Updated Grand Totals:", grandTotals);

    // Trim the list to remove the events we just processed
    await redisClient.ltrim("events", eventsAsStrings.length, -1);
  } catch (err) {
    logger.error("Error in worker:", err);
  }
}

async function startWorker() {
  await connectAll();
  logger.info(
    "🚀 Polling worker started. Checking for events every 5 seconds."
  );
  setInterval(processEvents, 5000);
}

startWorker();
