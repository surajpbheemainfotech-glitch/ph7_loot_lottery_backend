import dotenv from "dotenv";
import app from "./app.js";

import { connectDB } from "./config/db.js";
import { connectRedis } from "./redis/redisClient.js";
import { registerSchedulers } from "./scheduler/bullmq.scheduler.js";

import { logger } from "./config/loggers.js";
import { startWorkers } from "./queues/workers/start.worker.js";

dotenv.config();

const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST;

async function start() {
  try {
    await connectDB();
    await connectRedis();
 
    await registerSchedulers();
    await startWorkers();

    const server = app.listen(PORT, HOST, () => {
      logger.info(
        { host: HOST || "localhost", port: PORT },
        "Server started"
      );
    });

    process.on("SIGINT", () => server.close(() => process.exit(0)));
    process.on("SIGTERM", () => server.close(() => process.exit(0)));

  } catch (err) {
    logger.fatal({ err }, "Startup failed");
    process.exit(1);
  }
}

start();