import supertest from "supertest";
import { createApp } from "../../src/app";
import { connectAll, pool, redisClient } from "../../src/db/connection";

const { app } = createApp();
const request = supertest(app);

describe("Rate Limiting Integration", () => {
  beforeAll(async () => {
    await connectAll();
  });

  afterAll(async () => {
    // Cleanup if necessary
    await pool.end();
    await redisClient.quit();
  });

  describe("writeLimiter (POST /track)", () => {
    it("should allow requests up to the limit and then return 429", async () => {
      const event = {
        eventName: "rate_limit_test",
        url: "http://test.com",
        userId: "user_rl",
        metadata: {}
      };

      // Limit is set to 2 in .env.test
      // Request 1
      const res1 = await request
        .post("/track")
        .set("x-api-key", "test-api-key")
        .send(event);
      expect(res1.status).toBe(200);

      // Request 2
      const res2 = await request
        .post("/track")
        .set("x-api-key", "test-api-key")
        .send(event);
      expect(res2.status).toBe(200);

      // Request 3 - Should be rate limited
      const res3 = await request
        .post("/track")
        .set("x-api-key", "test-api-key")
        .send(event);
      
      expect(res3.status).toBe(429);
      expect(res3.body.success).toBe(false);
      expect(res3.body.message).toMatch(/Too many requests/);
    });
  });

  describe("globalLimiter (GET /health)", () => {
    it("should enforce global rate limits", async () => {
      // Global limit is set to 5 in .env.test
      // We already used some requests in the previous test IF it counts globally too.
      // But /track has BOTH global and write limiters? 
      // In app.ts: app.use(globalLimiter); 
      // In eventTracker.ts: route.post("/track", apiKey, writeLimiter, ...)
      // So /track hits BOTH. 
      
      // Let's just hit /health until we hit the global limit.
      // We might have already used 3 hits from the previous test.
      
      for (let i = 0; i < 10; i++) {
        const res = await request.get("/health");
        if (res.status === 429) {
          expect(res.body.success).toBe(false);
          expect(res.body.message).toMatch(/Too many requests from this IP/);
          return; // Success
        }
      }
      
      throw new Error("Global rate limit was not triggered after 10 requests");
    });
  });
});
