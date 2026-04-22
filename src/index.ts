import { createApp } from "./app";
import { connectAll } from "./db/connection";
import logger from "./utils/logger";

const PORT = Number(process.env.PORT) || 5000;
const { httpServer } = createApp();

(async () => {
  try {
    await connectAll();

    httpServer.listen(PORT, "0.0.0.0", () => {
      logger.info(
        `🚀 Server with Socket.IO is running on http://0.0.0.0:${PORT}`
      );
    });
  } catch (err) {
    logger.error("Failed to start server", err);
    process.exit(1);
  }
})();
