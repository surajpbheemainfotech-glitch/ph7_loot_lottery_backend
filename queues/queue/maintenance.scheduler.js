import { maintenanceQueue } from "./maintenance.queue.js";
import { logger } from "../../config/loggers.js";

export async function Schedulers() {
  const start = Date.now();

  try {
    logger.info(
      { action: "scheduler.init" },
      "Initializing BullMQ schedulers"
    );

    // Every 6 hours
    await maintenanceQueue.upsertJobScheduler(
      "pool-maintenance-6h",
      { every: 6 * 60 * 60 * 1000 },
      {
        name: "pool-maintenance",
        data: {},
      }
    );

    logger.info(
      {
        action: "scheduler.register",
        schedulerId: "pool-maintenance-6h",
        jobName: "pool-maintenance",
        intervalMs: 6 * 60 * 60 * 1000,
      },
      "Pool maintenance scheduler registered"
    );

    // Every 30 minutes
    await maintenanceQueue.upsertJobScheduler(
      "otp-cleanup-30m",
      { every: 30 * 60 * 1000 },
      {
        name: "otp-cleanup",
        data: {},
      }
    );

    logger.info(
      {
        action: "scheduler.register",
        schedulerId: "otp-cleanup-30m",
        jobName: "otp-cleanup",
        intervalMs: 30 * 60 * 1000,
      },
      "OTP cleanup scheduler registered"
    );

    logger.info(
      {
        action: "scheduler.init",
        durationMs: Date.now() - start,
      },
      "All schedulers registered successfully"
    );
  } catch (err) {
    logger.error(
      {
        action: "scheduler.init",
        err,
        durationMs: Date.now() - start,
      },
      "Scheduler initialization failed"
    );

    throw err; 
  }
}