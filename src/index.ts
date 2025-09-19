
import express from "express";
import { connectAll } from "./db/connection";
import trackRouter from "./router/eventTracker";
import logger from "./utils/logger";
const app = express();

app.use(express.json());
const PORT = 5000;

app.use("/", trackRouter);
(async () => {
  try {
    await connectAll();

    app.listen(PORT, () => {
      logger.info(`🚀 Server running on http://localhost:${PORT}`);
    });
  } catch (err) {
    logger.error("Failed to start server", err);
    process.exit(1);
  }
})();
