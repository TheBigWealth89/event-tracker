import { io as Client, Socket } from "socket.io-client";
import supertest from "supertest";
import { createApp } from "../../src/app";
import { connectAll, redisClient, pool } from "../../src/db/connection";
import { processEvents } from "../../src/workers";

const PORT = 5001;
const { httpServer, app } = createApp();
const request = supertest(app);

describe("E2E: Track to Socket Flow", () => {
  let clientSocket: Socket;

  beforeAll(async () => {
    await connectAll();
    // Clear state
    await redisClient.flushall();
    await pool.query("DELETE FROM event_counts");

    await new Promise<void>((resolve) => {
      httpServer.listen(PORT, resolve);
    });
  });

  afterAll(async () => {
    httpServer.close();
    if (clientSocket) clientSocket.close();
  });

  it("should broadcast update to socket when event is tracked and processed", async () => {
    clientSocket = Client(`http://localhost:${PORT}`);

    // Create a promise that resolves when the socket receives the update
    const updateReceived = new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error("Socket timeout")), 5000);
      clientSocket.on("analytics-update", (data) => {
        clearTimeout(timeout);
        try {
          expect(data).toHaveProperty("purchase");
          expect(data.purchase).toBe("1");
          resolve();
        } catch (error) {
          reject(error);
        }
      });
    });

    await new Promise<void>((resolve) => {
      clientSocket.on("connect", resolve);
    });

    // 1. Track an event via HTTP
    await request.post("/track").send({
      eventName: "purchase",
      url: "http://shop.com",
      userId: "customer_1"
    });

    // 2. Manually trigger worker processing (simulating the separate process)
    await processEvents("0-0");

    // 3. Wait for the socket update promise to finish
    await updateReceived;
  });
});
