import pino from "pino";

export const logger = pino({
  level: process.env.LOG_LEVEL || "info",
  base: {
    service: process.env.SERVICE_NAME || "backend",
    env: process.env.NODE_ENV || "development",
  },
  redact: [
    "req.headers.authorization",
    "req.headers.cookie",
    "password",
    "newPassword",
    "otp",
  ],
});