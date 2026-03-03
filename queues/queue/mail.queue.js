import { Queue } from "bullmq";
import { bullConnection } from "./connect.queue.js";


export const mailQueue = new Queue("mailQueue", {
  
  connection: bullConnection,
  defaultJobOptions: {
    attempts: 5,
    backoff: { type: "exponential", delay: 2000 },
    removeOnComplete: 1000,
    removeOnFail: 2000,
  },
});