import { redisClient, connectAll } from "../db/connection";
import logger from "../utils/logger";

const AGGREGATION_KEY = "analytics:event_counts"; // The name of our Redis Hash
const STREAM_KEY = "events";

let lastReadId = "0-0";

async function processEvents() {
  try {
    const response = await redisClient.xread(
      "BLOCK",
      5000,
      "STREAMS",
      STREAM_KEY,
      lastReadId // start ID
    );

    console.log("Event Response", response?.entries);

    if (!response) {
      logger.info("No new events in the last 5 seconds");
      return;
    }

    const [streamName, entries] = response[0];
    if (entries.length === 0) {
      return;
    }

    logger.info(`Processing a batch of ${entries.length} events.`);

    const multi = redisClient.multi();
    for (const [id, fields] of entries) {
      const eventData: Record<string, string> = {};
      for (let i = 0; i < fields.length; i += 2) {
        eventData[fields[1]] = fields[i + 1];
      }
      console.log("My code is still running here ");

      const eventName = eventData.eventName || "Unknown";
      //HINCRBY to do math inside Redis
      multi.hincrby(AGGREGATION_KEY, eventName, 1);
    }
    await multi.exec();

    //Update our events to the ID of the LAST event we just processed.
    lastReadId = entries[entries.length - 1][0];
    const grandTotals = await redisClient.hgetall(AGGREGATION_KEY);
    console.log("Updated Grand Totals:", grandTotals);
  } catch (err) {
    logger.error("Error in worker:", err);
  }
}

async function startWorker() {
  await connectAll();
  logger.info(
    `🚀 Stream worker started. Listening for events on stream '${STREAM_KEY}'.`
  );
  while (true) {
    await processEvents();
  }
}

startWorker();
