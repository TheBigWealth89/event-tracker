import winston from "winston";
import { join } from "path";

/**
 * Professional Logging Configuration
 * 
 * - Development: Console (Colorized) + Local Files (logs/*.log).
 * - Production: Console (Structured JSON) -> Docker Driver handle rotation.
 * - Security: Automatic redaction of sensitive keys.
 */

const logDir: string = join(__dirname, "..", "..", "logs");
const LOG_LEVEL = process.env.LOG_LEVEL || "info";
const NODE_ENV = process.env.NODE_ENV || "development";
const isProduction = NODE_ENV === "production";

// Keys that should NEVER be logged in plaintext
const SENSITIVE_KEYS = ["password", "token", "secret", "authorization", "apikey", "cookie"];

/**
 * Deep redaction of sensitive keys in log objects
 */
const redact = winston.format((info) => {
  const result = { ...info };
  
  const mask = (obj: any) => {
    if (!obj || typeof obj !== "object") return;
    
    Object.keys(obj).forEach((key) => {
      const val = obj[key];
      if (SENSITIVE_KEYS.includes(key.toLowerCase())) {
        obj[key] = "[REDACTED]";
      } else if (typeof val === "string") {
        // Redact passwords in connection strings (e.g., redis://user:password@host)
        // This regex looks for :password@ between the protocol and host
        obj[key] = val.replace(/(:\/\/[^/]*?)([:])(.*?)(@[^@/]+(?:\/|$))/g, "$1$2[REDACTED]$4");
      } else if (typeof val === "object") {
        mask(val);
      }
    });
  };

  mask(result);
  return result;
});

/**
 * Human-friendly format for development
 */
const devFormat = winston.format.combine(
  winston.format.timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
  redact(),
  winston.format.colorize(),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    const metaStr = Object.keys(meta).length ? `\n${JSON.stringify(meta, null, 2)}` : "";
    return `${timestamp} [${level}]: ${message}${metaStr}`;
  })
);

/**
 * Machine-readable format for Production
 */
const prodFormat = winston.format.combine(
  winston.format.timestamp(),
  redact(),
  winston.format.json()
);

const transports: winston.transport[] = [
  new winston.transports.Console({
    stderrLevels: ["error"],
  }),
];

// Add file logging ONLY in development
if (!isProduction) {
  transports.push(
    new winston.transports.File({
      filename: join(logDir, "error.log"),
      level: "error",
      format: prodFormat, // Store JSON in files even in dev
    }),
    new winston.transports.File({
      filename: join(logDir, "combined.log"),
      format: prodFormat,
    })
  );
}

const logger = winston.createLogger({
  level: LOG_LEVEL,
  format: isProduction ? prodFormat : devFormat,
  transports,
});

export default logger;
