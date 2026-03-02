import { Worker } from "bullmq";
import { bullConnection } from "../queue/connect.queue.js";
import { logger } from "../../config/logger.js";


import { poolExpireJob } from "../../scheduler/jobs/poolExpire.job.js";
import { declareResultsJob } from "../../scheduler/jobs/declareResult.job.js";
import { deleteExpirePool } from "../../scheduler/services/pool.service.js";


import { deleteExpiredOtps } from "../../scheduler/services/otp.service.js";

const worker = new Worker(
  "maintenance",
  async (job) => {
    const start = Date.now();

    logger.info(
      {
        action: "worker.job_start",
        queue: "maintenance",
        jobName: job.name,
        jobId: job.id,
        attemptsMade: job.attemptsMade,
      },
      "Worker running"
    );

    try {
      if (job.name === "pool-maintenance") {
        await poolExpireJob();
        await declareResultsJob();
        await deleteExpirePool();

        logger.info(
          {
            action: "worker.job_success",
            queue: "maintenance",
            jobName: job.name,
            jobId: job.id,
            durationMs: Date.now() - start,
          },
          "Pool maintenance job completed"
        );

        return { ok: true };
      }

      if (job.name === "otp-cleanup") {
        await deleteExpiredOtps();

        logger.info(
          {
            action: "worker.job_success",
            queue: "maintenance",
            jobName: job.name,
            jobId: job.id,
            durationMs: Date.now() - start,
          },
          "OTP cleanup job completed"
        );

        return { ok: true };
      }

      logger.warn(
        {
          action: "worker.job_skipped",
          queue: "maintenance",
          jobName: job.name,
          jobId: job.id,
          durationMs: Date.now() - start,
        },
        "Unknown job name, skipped"
      );

      return { ok: true, skipped: true };
    } catch (err) {
      logger.error(
        {
          action: "worker.job_error",
          queue: "maintenance",
          jobName: job.name,
          jobId: job.id,
          err,
          durationMs: Date.now() - start,
        },
        "Worker job failed"
      );

      throw err;
    }
  },
  {
    connection: bullConnection,
  }
);

worker.on("completed", (job) => {
  logger.info(
    { action: "worker.event_completed", queue: "maintenance", jobId: job.id, jobName: job.name },
    "Job completed event"
  );
});

worker.on("failed", (job, err) => {
  logger.error(
    {
      action: "worker.event_failed",
      queue: "maintenance",
      jobId: job?.id,
      jobName: job?.name,
      err,
    },
    "Job failed event"
  );
});

worker.on("error", (err) => {
  logger.error({ action: "worker.error", queue: "maintenance", err }, "Worker error");
});