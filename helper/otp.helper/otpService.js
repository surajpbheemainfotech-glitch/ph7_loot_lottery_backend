import crypto from "crypto";
import { db } from "../../config/db.js";
import { logger } from "../../config/loggers.js";

const generateOtp = (digits = 6) => {
  const min = 10 ** (digits - 1);
  const max = 10 ** digits;
  return crypto.randomInt(min, max).toString();
};

const hashOtp = ({ otp, email, purpose }) => {
  if (!process.env.OTP_SECRET) {
    throw new Error("OTP_SECRET is not set");
  }

  return crypto
    .createHmac("sha256", process.env.OTP_SECRET)
    .update(`${otp}:${email}:${purpose}`)
    .digest("hex");
};

const maskEmail = (email = "") => {
  const [name, domain] = String(email).split("@");
  if (!name || !domain) return email;
  const visible = name.slice(0, 2);
  return `${visible}***@${domain}`;
};

export const createOtp = async ({ email, purpose = "forgot_password", ttlMinutes = 5 }) => {
  const start = Date.now();
  const safeEmail = maskEmail(email);

  logger.info(
    { action: "otp.create", email: safeEmail, purpose, ttlMinutes },
    "OTP create request"
  );

  try {
    const otp = generateOtp();
    const otpHash = hashOtp({ otp, email, purpose });
    const expiresAt = new Date(Date.now() + ttlMinutes * 60 * 1000);

    const [invalidateRes] = await db.execute(
      `UPDATE otp_tokens
       SET used_at = NOW()
       WHERE email = ? AND purpose = ? AND used_at IS NULL`,
      [email, purpose]
    );

    await db.execute(
      `INSERT INTO otp_tokens
       (email, purpose, otp_hash, expires_at, attempts, max_attempts)
       VALUES (?, ?, ?, ?, 0, 3)`,
      [email, purpose, otpHash, expiresAt]
    );

    logger.info(
      {
        action: "otp.create",
        email: safeEmail,
        purpose,
        invalidated: invalidateRes?.affectedRows ?? 0,
        durationMs: Date.now() - start,
      },
      "OTP created"
    );

    return { otp, ttlMinutes };
  } catch (err) {
    logger.error(
      { action: "otp.create", email: safeEmail, purpose, err, durationMs: Date.now() - start },
      "OTP create failed"
    );
    throw err;
  }
};

export const verifyOtp = async ({ email, purpose = "forgot_password", otp }) => {
  const start = Date.now();
  const safeEmail = maskEmail(email);

  logger.info(
    { action: "otp.verify", email: safeEmail, purpose },
    "OTP verify attempt"
  );

  try {
    const [rows] = await db.execute(
      `SELECT *
       FROM otp_tokens
       WHERE email = ?
         AND purpose = ?
         AND used_at IS NULL
       ORDER BY created_at DESC
       LIMIT 1`,
      [email, purpose]
    );

    if (rows.length === 0) {
      logger.warn(
        { action: "otp.verify", email: safeEmail, purpose, reason: "no_active_token", durationMs: Date.now() - start },
        "OTP verify failed"
      );
      return { ok: false };
    }

    const token = rows[0];

    if (new Date(token.expires_at) <= new Date()) {
      await db.execute(`UPDATE otp_tokens SET used_at = NOW() WHERE id = ?`, [token.id]);

      logger.warn(
        { action: "otp.verify", email: safeEmail, purpose, tokenId: token.id, reason: "expired", durationMs: Date.now() - start },
        "OTP verify failed"
      );

      return { ok: false };
    }

    if (token.attempts >= token.max_attempts) {
      await db.execute(`UPDATE otp_tokens SET used_at = NOW() WHERE id = ?`, [token.id]);

      logger.warn(
        {
          action: "otp.verify",
          email: safeEmail,
          purpose,
          tokenId: token.id,
          reason: "max_attempts_exceeded",
          attempts: token.attempts,
          maxAttempts: token.max_attempts,
          durationMs: Date.now() - start,
        },
        "OTP verify failed"
      );

      return { ok: false };
    }

    const incomingHash = hashOtp({ otp, email, purpose });

    await db.execute(`UPDATE otp_tokens SET attempts = attempts + 1 WHERE id = ?`, [token.id]);

    const match =
      token.otp_hash.length === incomingHash.length &&
      crypto.timingSafeEqual(Buffer.from(token.otp_hash), Buffer.from(incomingHash));

    if (!match) {
      logger.warn(
        {
          action: "otp.verify",
          email: safeEmail,
          purpose,
          tokenId: token.id,
          reason: "mismatch",
          durationMs: Date.now() - start,
        },
        "OTP verify failed"
      );

      return { ok: false };
    }

    await db.execute(`UPDATE otp_tokens SET used_at = NOW() WHERE id = ?`, [token.id]);

    logger.info(
      { action: "otp.verify", email: safeEmail, purpose, tokenId: token.id, durationMs: Date.now() - start },
      "OTP verified"
    );

    return { ok: true };
  } catch (err) {
    logger.error(
      { action: "otp.verify", email: safeEmail, purpose, err, durationMs: Date.now() - start },
      "OTP verify crashed"
    );
    throw err;
  }
};