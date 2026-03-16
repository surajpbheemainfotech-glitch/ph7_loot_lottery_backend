import "newrelic";

import express from "express";
import cookieParser from "cookie-parser";
import cors from "cors";

import adminRouter from "./routes/adminRoute.js";
import userRouter from "./routes/userRoute.js";
import poolsRouter from "./routes/poolsRoute.js";
import ticketRoute from "./routes/ticketRoute.js";
import paymentRoute from "./routes/paymentRoute.js";
import packageRouter from "./routes/packageRoute.js";

import uploadErrorHandler from "./middlewares/multerMiddleware.js";
import { errorHandler } from "./middlewares/errorHandlerMiddleware.js";

import { requestId, httpLogger } from "./middlewares/logger.middlewares/logger-middleware.js";

const app = express();

app.use(
  cors({
    origin: [
      "http://localhost:5173",
      "http://192.168.1.14:5173",
      "http://localhost:5174"
    ],
    credentials: true,
  })
);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// static files
app.use("/uploads", express.static("uploads"));

// logging
app.use(requestId);
app.use(httpLogger);

// routes
app.use("/api/admin", adminRouter);
app.use("/api/user", userRouter);
app.use("/api/pool", poolsRouter);
app.use("/api/ticket", ticketRoute);
app.use("/api/payment", paymentRoute);
app.use("/api/package", packageRouter);

// multer error
app.use(uploadErrorHandler);


app.get("/", async (req, res) => {
  req.log.info({ route: "/" }, "Health check");
  res.send(`server is running..`);
});


app.use(errorHandler);

export default app;