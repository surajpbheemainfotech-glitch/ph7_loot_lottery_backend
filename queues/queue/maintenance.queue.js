import { Queue } from "bullmq";
import { bullConnection } from "./connect.queue.js";

export const maintenanceQueue = new Queue("maintenance", {
  connection: bullConnection,
});