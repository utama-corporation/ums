import pino from "pino";
import { env } from "@ums/config";

export const logger = pino({
  level: env.LOG_LEVEL,
  redact: {
    paths: [
      "password",
      "pin",
      "token",
      "secret",
      "authorization",
      "cookie",
      "*.password",
      "*.pin",
      "*.token",
      "*.secret",
      "*.signatureBinary",
    ],
    censor: "[REDACTED]",
  },
  timestamp: pino.stdTimeFunctions.isoTime,
});
