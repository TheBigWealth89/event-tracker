import path from "path";
import fs from "fs";
import dotenv from "dotenv";
import logger from "../utils/logger";

function loadEnvironmentVariables() {
  if (process.env.NODE_ENV === "production") {
    logger.info("Running in production mode, skipping .env file.");
    return;
  }

  try {
    logger.info("Running in development mode, attempting to load .env file...");

    const envPath = path.resolve(__dirname, "../../.env");

    if (!fs.existsSync(envPath)) {
      logger.warn(`.env file not found at ${envPath}.`);
      return;
    }

    const result = dotenv.config({ path: envPath });

    if (result.error) {
      logger.error("Error loading .env file:", result.error);
    } else {
      logger.info(".env file loaded successfully.");
    }
  } catch (err) {
    if (
      typeof err === "object" &&
      err !== null &&
      "code" in err &&
      err.code === "MODULE_NOT_FOUND"
    ) {
      logger.warn("'dotenv' module not found. This is expected in production.");
    } else {
      logger.error("An unexpected error occurred while loading .env:", err);
    }
  }
}

// Execute the function immediately
loadEnvironmentVariables();
