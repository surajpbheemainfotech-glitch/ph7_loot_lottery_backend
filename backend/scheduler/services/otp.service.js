import { db } from "../../config/db.js";
import { logger } from "../../config/loggers.js";

export const deleteExpiredOtps = async () => {
  const start = Date.now();
  const ctx = { action: "otp.cleanup" };

  try {
    const [result] = await db.query(
      "DELETE FROM otp_tokens WHERE expire_at < NOW()"
    );

    const affected = result?.affectedRows ?? 0;

    logger.info(
      { ...ctx, affectedRows: affected, durationMs: Date.now() - start },
      "Expired OTPs deleted"
    );

    return affected;
  } catch (err) {
    logger.error(
      { ...ctx, err, durationMs: Date.now() - start },
      "OTP cleanup failed"
    );

    throw err; 
  }
};