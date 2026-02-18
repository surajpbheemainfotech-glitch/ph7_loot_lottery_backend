import crypto from "crypto";
import {db} from "../../config/db.js";


const generateOtp = (digits = 6) => {
  const min = 10 ** (digits - 1);
  const max = 10 ** digits;
  return crypto.randomInt(min, max).toString();
};

const hashOtp = ({ otp, email, purpose }) => {
  return crypto
    .createHmac("sha256", process.env.OTP_SECRET)
    .update(`${otp}:${email}:${purpose}`)
    .digest("hex");
};


export const createOtp = async ({
  email,
  purpose = "forgot_password",
  ttlMinutes = 5,
}) => {
  const otp = generateOtp();
  const otpHash = hashOtp({ otp, email, purpose });

  const expiresAt = new Date(Date.now() + ttlMinutes * 60 * 1000);

  // invalidate old tokens
  await db.execute(
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

  return { otp, ttlMinutes };
};

export const verifyOtp = async ({
  email,
  purpose = "forgot_password",
  otp,
}) => {
  const [rows] = await db.execute(
    `SELECT * FROM otp_tokens 
     WHERE email = ? 
     AND purpose = ? 
     AND used_at IS NULL
     ORDER BY created_at DESC 
     LIMIT 1`,
    [email, purpose]
  );

  if (rows.length === 0) return { ok: false };

  const token = rows[0];

  if (new Date(token.expires_at) <= new Date()) {
    await db.execute(
      `UPDATE otp_tokens SET used_at = NOW() WHERE id = ?`,
      [token.id]
    );
    return { ok: false };
  }

  if (token.attempts >= token.max_attempts) {
    await db.execute(
      `UPDATE otp_tokens SET used_at = NOW() WHERE id = ?`,
      [token.id]
    );
    return { ok: false };
  }

  const incomingHash = hashOtp({ otp, email, purpose });

  await db.execute(
    `UPDATE otp_tokens SET attempts = attempts + 1 WHERE id = ?`,
    [token.id]
  );

  const match =
    token.otp_hash.length === incomingHash.length &&
    crypto.timingSafeEqual(
      Buffer.from(token.otp_hash),
      Buffer.from(incomingHash)
    );

  if (!match) return { ok: false };

  await db.execute(
    `UPDATE otp_tokens SET used_at = NOW() WHERE id = ?`,
    [token.id]
  );

  return { ok: true };
};
