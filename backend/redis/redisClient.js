import { createClient } from "redis";
import { logger } from "../config/loggers.js";

const REDIS_URL = process.env.REDIS_URL;

export const redisClient = createClient({ url: REDIS_URL });

redisClient.on("connect", () => {
  logger.info(
    { action: "redis.connect", url: REDIS_URL },
    "Redis connecting"
  );
});

redisClient.on("ready", () => {
  logger.info(
    { action: "redis.ready" },
    "Redis ready"
  );
});

redisClient.on("reconnecting", () => {
  logger.warn(
    { action: "redis.reconnecting" },
    "Redis reconnecting"
  );
});

redisClient.on("end", () => {
  logger.warn(
    { action: "redis.disconnected" },
    "Redis connection closed"
  );
});

redisClient.on("error", (err) => {
  logger.error(
    { action: "redis.error", err },
    "Redis error"
  );
});

export async function connectRedis() {
  if (!redisClient.isOpen) {
    try {
      logger.info({ action: "redis.init" }, "Initializing Redis connection");

      await redisClient.connect();

      logger.info({ action: "redis.init_success" }, "Redis connected successfully");
    } catch (err) {
      logger.fatal(
        { action: "redis.init_failed", err },
        "Redis connection failed"
      );
      throw err;
    }
  }
}