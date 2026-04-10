import { Worker } from "bullmq";
import { bullConnection } from "../queue/connect.queue.js";
import { logger } from "../../config/loggers.js";

import sendEmail from "../../sevices/service.mail/sendEmail.js"; 
import { MAIL_BUILDERS } from "../../sevices/service.mail/builders/index.js";

export const mailWorker = new Worker(
  "mailQueue",
  async (job) => {
    const start = Date.now();
    const { type, to, payload, meta } = job.data;
const queuedForMs = Date.now() - job.timestamp;
    logger.info(
      { action: "mail.worker.start", jobId: job.id, type, to, meta ,queuedForMs },
      "Mail worker started"
    );

    const builder = MAIL_BUILDERS[type];
    if (!builder) {
      throw new Error(`Unknown mail type: ${type}`);
    }

    const built = builder(payload);

    await sendEmail({
      to,
      subject: built.subject,
      text: built.text,
      html: built.html,
    });

    logger.info(
      {
        action: "mail.worker.done",
        jobId: job.id,
        type,
        durationMs: Date.now() - start,
      },
      "Mail worker completed"
    );

    return { success: true };
  },
  {
    connection: bullConnection,
    concurrency: 5,
   
  }
);

mailWorker.on("failed", (job, err) => {
  logger.error(
    { action: "mail.worker.failed", jobId: job?.id, type: job?.data?.type, err },
    "Mail job failed"
  );
});

mailWorker.on("ready", () => {
  logger.info({ action: "mail.worker.ready" }, "Mail worker is ready");
});

mailWorker.on("error", (err) => {
  logger.error({ action: "mail.worker.error", err }, "Mail worker error");
});