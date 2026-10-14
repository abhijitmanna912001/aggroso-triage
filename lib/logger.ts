import "server-only";
import pino from "pino";

export const logger = pino({
  level: process.env.LOG_LEVEL || "info",
  base: { service: "triage" },
  redact: {
    paths: [
      "DATABASE_URL",
      "DIRECT_URL",
      "OPENAI_API_KEY",
      "connectionString",
      "password",
      "apiKey",
      "authorization",
      "*.DATABASE_URL",
      "*.DIRECT_URL",
      "*.OPENAI_API_KEY",
      "*.connectionString",
      "*.password",
      "*.apiKey",
      "*.authorization",
      "*.headers.authorization",
    ],
    censor: "[REDACTED]",
  },
});
