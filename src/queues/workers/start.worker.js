import { mailWorker } from "./mail.worker.js";
import "./maintenance.worker.js"; 

export const startWorkers = async () => {

  mailWorker.on("ready", () => {
    console.log("mail.worker ready");
  });

  mailWorker.on("error", (err) => {
    console.error("mail.worker error", err);
  });

  mailWorker.on("failed", (job, err) => {
    console.error(`Mail Job failed: ${job?.id}`, err);
  });

  mailWorker.on("completed", (job) => {
    console.log(`Mail Job completed: ${job.id}`);
  });

  console.log("All workers initialized");
};