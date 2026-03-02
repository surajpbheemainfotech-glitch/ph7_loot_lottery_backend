import pino from "pino";

const isDev = process.env.NODE_ENV !== "production";

export const logger = pino(
  {
    level: process.env.LOG_LEVEL || "info",
    base: { service: "backend", env: process.env.NODE_ENV || "development" },
    timestamp: () => `,"time":"${new Date().toISOString()}"`,
  },
  isDev
    ? pino.transport({
        target: "pino-pretty",
        options: {
          colorize: true,
          translateTime: "dd mmm yyyy HH:MM:ss.l",
          singleLine: true,
          ignore: "pid,hostname",
        },
      })
    : undefined
);