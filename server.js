import "newrelic";

import express from "express";
import cookieParser from "cookie-parser";
import cors from "cors";
import dotenv from "dotenv";

import { connectDB } from "./config/db.js";
import adminRouter from "./routes/adminRoute.js";
import userRouter from "./routes/userRoute.js";
import poolsRouter from "./routes/poolsRoute.js";
import uploadErrorHandler from "./middlewares/multerMiddleware.js";
import ticketRoute from "./routes/ticketRoute.js";
import paymentRoute from "./routes/paymentRoute.js";
import packageRouter from "./routes/packageRoute.js";

import { errorHandler } from "./middlewares/errorHandlerMiddleware.js";


import { connectRedis } from "./redis/redisClient.js";
import { registerSchedulers } from "./scheduler/bullmq.scheduler.js";

import { requestId, httpLogger } from "./middlewares/logger.middlewares/logger-middleware.js";
import { logger } from "./config/loggers.js";
import { mailWorker } from "./queues/workers/mail.worker.js";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST;

app.use(
  cors({
    origin: ["http://localhost:5173", "http://10.151.204.145:5173", "http://localhost:5174"],
    credentials: true,
  })
);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use("/uploads", express.static("uploads"));

// logging middlewares 
app.use(requestId);
app.use(httpLogger);

// routes
app.use("/api/admin", adminRouter);
app.use("/api/user", userRouter);
app.use("/api/pool", poolsRouter);
app.use("/api/ticket", ticketRoute);
app.use("/api/payment", paymentRoute);
app.use("/api/package", packageRouter);


app.use(uploadErrorHandler);

app.get("/", async (req, res) => {
  req.log.info({ route: "/" }, "Health check");
  res.send(`server is running on ${PORT}..`);
});

app.use(errorHandler);

async function start() {
  try {
    await connectDB();
    await connectRedis();
    await registerSchedulers();

    const server = app.listen(PORT, HOST, () => {

      logger.info(
        { host: HOST || "localhost", port: PORT },
        "Server started"
      );
    });

    mailWorker.on("ready", () => console.log("✅ mail.worker ready"));
mailWorker.on("error", (e) => console.error("❌ mail.worker error", e));

    process.on("SIGINT", () => server.close(() => process.exit(0)));
    process.on("SIGTERM", () => server.close(() => process.exit(0)));
  } catch (err) {
    logger.fatal({ err }, "Startup failed");
    process.exit(1);
  }
}

start();