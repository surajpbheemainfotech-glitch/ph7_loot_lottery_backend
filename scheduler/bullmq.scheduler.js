import { maintenanceQueue } from "../queues/queue/maintenance.queue.js";
import { logger } from "../config/loggers.js";


export async function registerSchedulers() {
  const start = Date.now();

  try {
    logger.info({ action: "scheduler.init" }, "Initializing BullMQ schedulers");

    await maintenanceQueue.upsertJobScheduler(
      "pool-maintenance-6h",
      { every: 24 * 60 * 60 * 1000 },
      { name: "pool-maintenance", data: {} }
    );

    await maintenanceQueue.upsertJobScheduler(
      "otp-cleanup-30m",
      { every: 30 * 60 * 1000 },
      { name: "otp-cleanup", data: {} }
    );

    await maintenanceQueue.upsertJobScheduler(
      "mail-cleanup-12h",
      { every: 12 * 60 * 60 * 1000 },
      { name: "mail-cleanup", data: {} }
    );

    logger.info(
      { action: "scheduler.init", durationMs: Date.now() - start },
      "All schedulers registered successfully"
    );
  } catch (err) {
    logger.error(
      { action: "scheduler.init", err, durationMs: Date.now() - start },
      "Scheduler initialization failed"
    );
    throw err;
  }
}