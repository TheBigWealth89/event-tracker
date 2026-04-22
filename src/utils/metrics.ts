import { redisClient } from "../db/connection";
import logger from "./logger";

/**
 * Hand-rolled Prometheus text builder.
 * Constructs the exposition format string manually to avoid additional dependencies.
 */
export async function buildPrometheusText(): Promise<string> {
  const lines: string[] = [];

  // 1. Uptime
  lines.push(`# HELP event_tracker_uptime_seconds Process uptime in seconds.`);
  lines.push(`# TYPE event_tracker_uptime_seconds gauge`);
  lines.push(`event_tracker_uptime_seconds ${process.uptime()}`);

  // 2. Memory
  const mem = process.memoryUsage();
  lines.push(
    `# HELP event_tracker_memory_heap_used_bytes Process heap used in bytes.`
  );
  lines.push(`# TYPE event_tracker_memory_heap_used_bytes gauge`);
  lines.push(`event_tracker_memory_heap_used_bytes ${mem.heapUsed}`);

  // 3. Redis Stream Length
  let streamLength = 0;
  try {
    streamLength = await redisClient.xlen("events");
  } catch (err) {
    logger.error("Failed to get stream length for metrics", err);
  }
  lines.push(
    `# HELP event_tracker_redis_stream_length Number of events in the Redis stream.`
  );
  lines.push(`# TYPE event_tracker_redis_stream_length gauge`);
  lines.push(`event_tracker_redis_stream_length ${streamLength}`);

  // Worker State
  let lagSeconds = 0;
  let heartbeatLagSeconds = 999999;
  let totalEvents = 0;
  try {
    const heartbeatStr = await redisClient.get("worker:heartbeat");
    if (heartbeatStr) {
      const lastHeartbeat = new Date(heartbeatStr).getTime();
      heartbeatLagSeconds = Math.max(0, (Date.now() - lastHeartbeat) / 1000);
    } else {
      heartbeatLagSeconds = 999999;
    }

    const lastProcessedAtStr = await redisClient.get(
      "worker:last_processed_at"
    );
    if (lastProcessedAtStr) {
      const lastProcessedAt = new Date(lastProcessedAtStr).getTime();
      lagSeconds = Math.max(0, (Date.now() - lastProcessedAt) / 1000);
    }

    const totalEventsStr = await redisClient.get(
      "worker:events_processed_total"
    );
    if (totalEventsStr) {
      totalEvents = parseInt(totalEventsStr, 10);
      if (isNaN(totalEvents)) totalEvents = 0;
    }
  } catch (err) {
    logger.error("Failed to get worker state for metrics", err);
  }

  // 4. Worker Heartbeat Lag Seconds
  lines.push(
    `# HELP event_tracker_worker_heartbeat_lag_seconds Seconds since the worker last sent a heartbeat.`
  );
  lines.push(`# TYPE event_tracker_worker_heartbeat_lag_seconds gauge`);
  lines.push(
    `event_tracker_worker_heartbeat_lag_seconds ${heartbeatLagSeconds.toFixed(3)}`
  );

  // 5. Worker Lag Seconds
  lines.push(
    `# HELP event_tracker_worker_lag_seconds Seconds since the worker last processed a batch.`
  );
  lines.push(`# TYPE event_tracker_worker_lag_seconds gauge`);
  lines.push(`event_tracker_worker_lag_seconds ${lagSeconds.toFixed(3)}`);

  // 6. Worker Events Processed Total
  lines.push(
    `# HELP event_tracker_worker_events_processed_total Total count of events processed by worker.`
  );
  lines.push(`# TYPE event_tracker_worker_events_processed_total counter`);
  lines.push(`event_tracker_worker_events_processed_total ${totalEvents}`);

  // Important: Prometheus format requires a trailing newline
  return lines.join("\n") + "\n";
}
