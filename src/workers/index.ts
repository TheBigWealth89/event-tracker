import { redisClient, connectAll, pool } from "../db/connection";
import logger from "../utils/logger";

const AGGREGATION_KEY = "analytics:event_counts"; // The name of our Redis Hash
const STREAM_KEY = "events";
const BOOKMARK_KEY = "analytics_worker:last_id";

async function processEvents(lastReadId: string): Promise<string> {
  let nextReadId = lastReadId;
  try {
    const response = await redisClient.xread(
      "BLOCK",
      5000,
      "STREAMS",
      STREAM_KEY,
      nextReadId // start ID
    );

    logger.info("Coming nextread id ", nextReadId);
    if (!response) {
      logger.info("No new events in the last 5 seconds");
      return nextReadId;
    }

    const [, entries] = response[0];
    if (entries.length === 0) {
      return nextReadId;
    }

    logger.info(`Processing a batch of ${entries.length} events.`);

    const multi = redisClient.multi();
    for (const [, fields] of entries) {
      const eventData: Record<string, string> = {};
      for (let i = 0; i < fields.length; i += 2) {
        eventData[fields[i]] = fields[i + 1];
      }

      const eventName = eventData.eventName || "Unknown";
      //HINCRBY to do math inside Redis
      multi.hincrby(AGGREGATION_KEY, eventName, 1);
    }
    await multi.exec();

    // Update our bookmark to the ID of the LAST event we just processed.
    nextReadId = entries[entries.length - 1][0];
    logger.info("update our bookmark", nextReadId);

    // Save the bookmark back to Redis.
    await redisClient.set(BOOKMARK_KEY, nextReadId);

    //Get all the aggregate
    const grandTotals = await redisClient.hgetall(AGGREGATION_KEY);

    // ... after you've calculated grandTotals ...
    console.log("Updated Grand Totals in Redis:", grandTotals);

    // WRITING TO POSTGRESQL
    if (Object.keys(grandTotals).length > 0) {
      console.log("Writing aggregated totals to TimescaleDB...");
      try {
        const values: (string | number)[] = [];
        const valueStrings: string[] = [];
        let paramIndex = 1;

        for (const [eventName, count] of Object.entries(grandTotals)) {
          valueStrings.push(`(NOW(), $${paramIndex}, $${paramIndex + 1})`);
          values.push(eventName, count);
          paramIndex += 2;
        }
        console.log("Writing to db");
        const queryText = `
            INSERT INTO event_counts (bucket, event_name, count)
            VALUES ${valueStrings.join(", ")} 
            ON CONFLICT (bucket, event_name) DO UPDATE
            SET count = event_counts.count + EXCLUDED.count;
        `;

        await pool.query(queryText, values);
        console.log("✅ Successfully updated totals in TimescaleDB.");
      } catch (dbError) {
        logger.error("❌ Failed to write to TimescaleDB:", dbError);
      }
    }
  } catch (err) {
    logger.error("Error in worker:", err);
  }
  return nextReadId;
}

async function startWorker() {
  await connectAll();
  logger.info(
    `🚀 Stream worker started. Listening for events on stream '${STREAM_KEY}'.`
  );

  // Get the last saved bookmark from Redis.
  let lastReadId = (await redisClient.get(BOOKMARK_KEY)) || "0-0";
  logger.info(`Starting stream from last known ID: ${lastReadId}`);

  while (true) {
    // Pass the current bookmark in, get the next one back.
    lastReadId = await processEvents(lastReadId);
  }
}

startWorker();
