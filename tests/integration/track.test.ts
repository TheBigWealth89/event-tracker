import supertest from "supertest";
import { createApp } from "../../src/app";
import { redisClient, connectAll } from "../../src/db/connection";

const { app } = createApp();
const request = supertest(app);

describe("POST /track", () => {
  beforeAll(async () => {
    await connectAll();
  });

  it("should track a valid event and return 200", async () => {
    const event = {
      eventName: "test_event",
      url: "http://test.com",
      userId: "user_1",
      metadata: { foo: "bar" }
    };

    const response = await request
      .post("/track")
      .set("x-api-key", "test-api-key")
      .send(event);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.event.eventName).toBe("test_event");

    // Verify it reached Redis  
    const streamLen = await redisClient.xlen("events");
    expect(streamLen).toBeGreaterThan(0);
  });

  it("should return 401 if API key is missing", async () => {
    const response = await request.post("/track").send({ eventName: "test" });
    expect(response.status).toBe(401);
  });

  it("should return 403 if API key is invalid", async () => {
    const response = await request
      .post("/track")
      .set("x-api-key", "wrong-key")
      .send({ eventName: "test" });
    expect(response.status).toBe(403);
  });

  it("should return 400 for invalid payload", async () => {
    const invalidEvent = {
      url: "http://test.com" // Missing eventName
    };

    const response = await request
      .post("/track")
      .set("x-api-key", "test-api-key")
      .send(invalidEvent);

    expect(response.status).toBe(400);
    expect(response.body.errors).toHaveProperty("eventName");
  });
});
