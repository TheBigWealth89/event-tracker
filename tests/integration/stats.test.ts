import supertest from "supertest";
import { createApp } from "../../src/app";
import { redisClient, connectAll } from "../../src/db/connection";

const { app } = createApp();
const request = supertest(app);

describe("GET /api/stats", () => {
  beforeAll(async () => {
    await connectAll();
  });

  it("should return aggregated counts from Redis", async () => {
    const AGGREGATION_KEY = "analytics:event_counts";
    await redisClient.del(AGGREGATION_KEY);
    await redisClient.hset(AGGREGATION_KEY, "click", "10", "view", "5");

    const response = await request.get("/api/stats");
    
    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data).toEqual({
      click: "10",
      view: "5"
    });
  });

  it("should return empty object if no stats exist", async () => {
    await redisClient.del("analytics:event_counts");

    const response = await request.get("/api/stats");
    
    expect(response.status).toBe(200);
    expect(response.body.data).toEqual({});
  });
});
