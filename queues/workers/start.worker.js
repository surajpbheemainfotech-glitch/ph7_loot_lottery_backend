import { mailWorker } from "./mail.worker.js";

export const startMailWorker = async() => {
  mailWorker.on("ready", () => {
    console.log("mail.worker ready");
  });

  mailWorker.on("error", (err) => {
    console.error("mail.worker error", err);
  });

  mailWorker.on("failed", (job, err) => {
    console.error(`Job failed: ${job.id}`, err);
  });

  mailWorker.on("completed", (job) => {
    console.log(`Job completed: ${job.id}`);
  });
};