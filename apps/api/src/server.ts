import { createApp } from "./app.js";
import { env } from "@ums/config";
import { logger } from "./logger.js";
import { prisma } from "@ums/db";

const app = createApp();

const server = app.listen(env.PORT, () => {
  logger.info(`Express API listening on port ${env.PORT} [${env.NODE_ENV}]`);
});

async function gracefulShutdown(signal: string) {
  logger.info(`Received ${signal}. Shutting down gracefully...`);
  server.close(async () => {
    logger.info("HTTP server closed.");
    try {
      await prisma.$disconnect();
      logger.info("Database disconnected.");
      process.exit(0);
    } catch (err) {
      logger.error({ err }, "Error during database disconnect");
      process.exit(1);
    }
  });
}

process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("SIGINT", () => gracefulShutdown("SIGINT"));
