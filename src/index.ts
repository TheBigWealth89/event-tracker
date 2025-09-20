import express from "express";
import { connectAll } from "./db/connection";
import trackRouter from "./router/eventTracker";
import { ZodError } from "zod";
import logger from "./utils/logger";
const app = express();

app.use(express.json());
const PORT = 5000;

app.use((err: any, req: any, res: any, next: any) => {
  if (err instanceof ZodError) {
    const { fieldErrors } = err.flatten();
    return res.status(400).json({ errors: fieldErrors });
  }
  console.error(err);
  res.status(500).json({ message: "Internal server error" });
});

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
