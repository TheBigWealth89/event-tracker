import supertest from "supertest";
import { createApp } from "../../src/app";
import { connectAll } from "../../src/db/connection";

const { app } = createApp();
const request = supertest(app);

describe("GET /metrics", () => {
  beforeAll(async () => {
    await connectAll();
  });

  it("should return prometheus metrics", async () => {
    const response = await request.get("/metrics");
    
    expect(response.status).toBe(200);
    expect(response.get("Content-Type")).toContain("text/plain");
    expect(response.text).toContain("event_tracker_uptime_seconds");
    expect(response.text).toContain("event_tracker_redis_stream_length");
  });
});
