import { mailQueue } from "../queue/mail.queue.js";

export const enqueueMail = async ({
  type,
  to,
  payload,
  meta = {},
  jobId,
  priority = 1,  
  delayMs = 0,
}) => {
  return mailQueue.add(
    "send_email",
    { type, to, payload, meta },
    { jobId, priority, delay: delayMs }
  );
};