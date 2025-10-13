import { createServer } from "http";
import { initSocket } from "./sockets";
import express, { Request, Response } from "express";
import { connectAll } from "./db/connection";
import trackRouter from "./router/eventTracker";
import { ZodError } from "zod";
import logger from "./utils/logger";
import path from "path";

const app = express();

app.use(express.json());

const PORT = Number(process.env.PORT) || 5000;
const httpServer = createServer(app);
initSocket(httpServer);
app.use(express.static(path.join(__dirname, "public")));
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

// Health checks
app.get("/health", (req: Request, res: Response) => {
  res.status(200).json({ status: "ok", timestamp: new Date().toISOString() });
});

app.use("/", trackRouter);

// Error handling middleware must be registered after routes and have 4 args
app.use((err: unknown, res: Response) => {
  if (err instanceof ZodError) {
    const { fieldErrors } = err.flatten();
    return res.status(400).json({ errors: fieldErrors });
  }
  logger.error(err);
  res.status(500).json({ message: "Internal server error" });
});

(async () => {
  try {
    await connectAll();

    httpServer.listen(PORT, () => {
      logger.info(
        `🚀 Server with Socket.IO is running on http://localhost:${PORT}`
      );
    });
  } catch (err) {
    logger.error("Failed to start server", err);
    process.exit(1);
  }
})();
