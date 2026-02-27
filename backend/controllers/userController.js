import bcrypt from 'bcryptjs'
import JWT from 'jsonwebtoken'
import { db } from '../config/db.js'
import buildForgotPasswordOtpEmail from '../helper/nodeMailer.helper/builders/otpEmailBuilder.js';
import sendEmail from '../helper/nodeMailer.helper/sendEmail.js';
import { createOtp } from "../helper/otp.helper/otpService.js"
import { verifyOtp } from "../helper/otp.helper/otpService.js"

export const register = async (req, res) => {
  const start = Date.now();
  const { title, first_name, last_name, email } = req.body;
  const role = "user";

  req.log.info({ action: "user.register", email }, "Register attempt");

  try {
    const { password } = req.body;

    if (!email || !password || !title || !first_name || !last_name) {
      req.log.warn(
        { action: "user.register", email, reason: "missing_fields" },
        "Register failed"
      );
      return res.status(400).json({ success: false, message: "Credentials are required" });
    }

    const [rows] = await db.execute("SELECT id FROM users WHERE email = ?", [email]);

    if (rows.length !== 0) {
      req.log.warn(
        { action: "user.register", email, reason: "already_exists" },
        "Register failed"
      );
      return res.status(409).json({ success: false, message: "User already exists" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const [result] = await db.execute(
      `INSERT INTO users (title, first_name, last_name, email, password, role)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [title, first_name, last_name, email, hashedPassword, role]
    );

    const userId = result.insertId;

    const token = JWT.sign(
      { id: userId, email, role },
      process.env.USER_JWT_SECRET,
      { expiresIn: "7d" }
    );

    res.cookie("user_token", token, {
      httpOnly: true,
      secure: false,
      sameSite: "lax",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    req.log.info(
      { action: "user.register", userId, durationMs: Date.now() - start },
      "Register successful"
    );

    return res.status(201).json({
      success: true,
      token,
      message: "Register successful",
      user: { id: userId, title, first_name, last_name, email },
    });
  } catch (err) {
    req.log.error(
      { action: "user.register", email, err, durationMs: Date.now() - start },
      "Register crashed"
    );
    return res.status(500).json({ success: false, message: err.message });
  }
};

export const login = async (req, res) => {
  const start = Date.now();
  const { email } = req.body;

  req.log.info({ action: "user.login", email }, "Login attempt");

  try {
    const { password } = req.body;

    if (!email || !password) {
      req.log.warn(
        { action: "user.login", email, reason: "missing_credentials" },
        "Login failed"
      );
      return res.json({ success: false, message: "Credential are required" });
    }

    const [rows] = await db.execute(
      "SELECT id,title, first_name, last_name, email, password , role, wallet FROM users WHERE email = ?",
      [email]
    );

    if (rows.length === 0) {
      req.log.warn(
        { action: "user.login", email, reason: "user_not_found" },
        "Login failed"
      );
      return res.status(401).json({ success: false, message: "User not found" });
    }

    const user = rows[0];

    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      req.log.warn(
        { action: "user.login", userId: user.id, reason: "wrong_password" },
        "Login failed"
      );
      return res.status(400).json({ success: false, message: "Invalid email or password" });
    }

    const token = JWT.sign(
      { userId: user.id, email: user.email },
      process.env.USER_JWT_SECRET,
      { expiresIn: "1d" }
    );

    res.cookie("user_token", token, {
      httpOnly: true,
      secure: false,
      sameSite: "lax",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    req.log.info(
      { action: "user.login", userId: user.id, durationMs: Date.now() - start },
      "Login successful"
    );

    return res.status(200).json({
      success: true,
      message: "Login successful",
      token,
      user: {
        id: user.id,
        first_name: user.first_name,
        last_name: user.last_name,
        email: user.email,
        role: user.role,
        wallet: user.wallet,
      },
    });
  } catch (err) {
    req.log.error(
      { action: "user.login", email, err, durationMs: Date.now() - start },
      "Login crashed"
    );
    return res.status(500).json({ success: false, message: "Server error", error: err.message });
  }
};

export const userDetailsById = async (req, res) => {
  const start = Date.now();
  const userId = req.params.id;

  req.log.info({ action: "user.profile", userId }, "User profile request");

  try {
    if (!userId) {
      req.log.warn({ action: "user.profile", reason: "missing_userId" }, "Profile failed");
      return res.status(401).json({ success: false, message: "User not logged in" });
    }

    const [userRows] = await db.execute(
      `SELECT id, title, first_name, last_name, email, role
       FROM users WHERE id = ?`,
      [userId]
    );

    if (userRows.length === 0) {
      req.log.warn({ action: "user.profile", userId, reason: "not_found" }, "Profile failed");
      return res.status(404).json({ success: false, message: "User not found" });
    }

    const user = userRows[0];

    const [packageRows] = await db.execute(
      `SELECT up.id AS user_package_id, up.user_id, up.package_id, up.purchased_at,
              p.package_name, p.package_price
       FROM user_packages up
       JOIN packages p ON p.id = up.package_id
       WHERE up.user_id = ?
       ORDER BY up.purchased_at DESC`,
      [userId]
    );

    if (packageRows.length === 0) {
      req.log.warn(
        { action: "user.profile", userId, reason: "no_package" },
        "Profile incomplete"
      );
      return res.status(409).json({ success: false, message: "Please select your plan" });
    }

    const [ticketRows] = await db.execute(
      `SELECT id, user_number, ticket_amount, draw_number, pool_name, payment_status
       FROM tickets WHERE user_id = ?`,
      [userId]
    );

    req.log.info(
      {
        action: "user.profile",
        userId,
        packageCount: packageRows.length,
        ticketCount: ticketRows.length,
        durationMs: Date.now() - start,
      },
      "User profile fetched"
    );

    return res.status(200).json({
      success: true,
      message: "User Profile",
      data: {
        user,
        package: packageRows,
        tickets: ticketRows.length ? ticketRows : null,
      },
    });
  } catch (err) {
    req.log.error(
      { action: "user.profile", userId, err, durationMs: Date.now() - start },
      "User profile crashed"
    );
    return res.status(500).json({ success: false, message: "Server error", error: err.message });
  }
};

export const forgetPasswordByUserEmail = async (req, res) => {
  const start = Date.now();
  const { email } = req.body;

  req.log.info({ action: "user.forgot_password", email }, "Forgot password request");

  try {
    if (!email) {
      req.log.warn({ action: "user.forgot_password", reason: "missing_email" }, "Forgot password failed");
      return res.status(400).json({ success: false, message: "Enter valid email" });
    }

    const [existingUser] = await db.execute(`SELECT * from users where email= ?`, [email]);

    if (existingUser.length === 0) {
      req.log.warn({ action: "user.forgot_password", email, reason: "user_not_found" }, "Forgot password failed");
      return res.status(400).json({ success: false, message: "Enter valid email" });
    }

    const user = existingUser[0];

    const { otp, ttlMinutes } = await createOtp({
      email,
      purpose: "user_forgot_password",
      ttlMinutes: 5,
    });

    req.log.info(
      { action: "user.forgot_password", userId: user.id, ttlMinutes },
      "OTP generated"
    );

    const { subject, html, text } = buildForgotPasswordOtpEmail({
      name: user.name || "user",
      otp,
      role: "user",
      expiryMinutes: ttlMinutes,
    });

    await sendEmail({ to: email, subject, html, text });

    req.log.info(
      { action: "user.forgot_password", userId: user.id, durationMs: Date.now() - start },
      "OTP email sent"
    );

    return res.status(200).json({ success: true, message: "OTP sent successfully" });
  } catch (err) {
    req.log.error(
      { action: "user.forgot_password", email, err, durationMs: Date.now() - start },
      "Forgot password crashed"
    );
    return res.status(500).json({ success: false, message: "Something went wrong" });
  }
};

export const verifyForgotPasswordUserOtp = async (req, res) => {
  const start = Date.now();
  const { email } = req.body;

  req.log.info({ action: "user.otp_verify", email }, "OTP verify attempt");

  try {
    const { otp } = req.body;

    if (!email || !otp) {
      req.log.warn({ action: "user.otp_verify", email, reason: "missing_email_or_otp" }, "OTP verify failed");
      return res.status(400).json({ success: false, message: "Email and OTP are required" });
    }

    const [existingUser] = await db.execute(
      `SELECT id FROM users WHERE email = ? LIMIT 1`,
      [email]
    );

    if (existingUser.length === 0) {
      req.log.warn({ action: "user.otp_verify", email, reason: "user_not_found" }, "OTP verify failed");
      return res.status(400).json({ success: false, message: "Invalid request" });
    }

    const userId = existingUser[0].id;

    const result = await verifyOtp({
      email,
      purpose: "user_forgot_password",
      otp,
    });

    if (!result.ok) {
      req.log.warn({ action: "user.otp_verify", userId, reason: "invalid_or_expired_otp" }, "OTP verify failed");
      return res.status(400).json({ success: false, message: "Invalid or expired OTP" });
    }

    req.log.info(
      { action: "user.otp_verify", userId, durationMs: Date.now() - start },
      "OTP verified"
    );

    return res.status(200).json({ success: true, message: "OTP verified successfully" });
  } catch (err) {
    req.log.error(
      { action: "user.otp_verify", email, err, durationMs: Date.now() - start },
      "OTP verify crashed"
    );
    return res.status(500).json({ success: false, message: "Something went wrong" });
  }
};

export const resetPasswordUser = async (req, res) => {
  const start = Date.now();
  const { email } = req.body;

  req.log.info({ action: "user.password_reset", email }, "Password reset attempt");

  try {
    const { newPassword } = req.body;

    if (!email || !newPassword) {
      req.log.warn({ action: "user.password_reset", email, reason: "missing_fields" }, "Password reset failed");
      return res.status(400).json({ success: false, message: "Email and new password are required" });
    }

    if (newPassword.length < 6) {
      req.log.warn({ action: "user.password_reset", email, reason: "password_too_short" }, "Password reset failed");
      return res.status(400).json({ success: false, message: "Password must be at least 6 characters" });
    }

    const [existingUser] = await db.execute(
      `SELECT id FROM users WHERE email = ? LIMIT 1`,
      [email]
    );

    if (existingUser.length === 0) {
      req.log.warn({ action: "user.password_reset", email, reason: "user_not_found" }, "Password reset failed");
      return res.status(400).json({ success: false, message: "Invalid request" });
    }

    const userId = existingUser[0].id;

    const hashedPassword = await bcrypt.hash(newPassword, 10);

    await db.execute(
      `UPDATE users SET password = ? WHERE email = ?`,
      [hashedPassword, email]
    );

    req.log.info(
      { action: "user.password_reset", userId, durationMs: Date.now() - start },
      "Password reset successful"
    );

    return res.status(200).json({ success: true, message: "Password reset successfully" });
  } catch (err) {
    req.log.error(
      { action: "user.password_reset", email, err, durationMs: Date.now() - start },
      "Password reset crashed"
    );
    return res.status(500).json({ success: false, message: "Something went wrong" });
  }
};

export const updateUserWallet = async (req, res) => {
  const start = Date.now();
  const { userId, amount } = req.body;

  req.log.info({ action: "user.update_wallet", userId }, "User wallet update request");

  try {
    if (!userId) {
      req.log.warn({ action: "user.update_wallet", reason: "missing_userId" }, "Wallet update failed");
      return res.status(401).json({ success: false, message: "User not logged in" });
    }

    const amtNum = Number(amount);
    if (!Number.isFinite(amtNum) || amtNum <= 0) {
      req.log.warn({ action: "user.update_wallet", reason: "invalid_amount", amount }, "Wallet update failed");
      return res.status(400).json({ success: false, message: "Valid amount is required" });
    }

    const [userRows] = await db.execute(
      `SELECT wallet FROM users WHERE id = ?`,
      [userId]
    );

    if (userRows.length === 0) {
      req.log.warn({ action: "user.update_wallet", userId, reason: "not_found" }, "Wallet update failed");
      return res.status(404).json({ success: false, message: "User not found" });
    }

    const walletNum = Number(userRows[0].wallet); // "0.00" -> 0
    if (!Number.isFinite(walletNum)) {
      req.log.error({ action: "user.update_wallet", userId, wallet: userRows[0].wallet }, "Invalid wallet value in DB");
      return res.status(500).json({ success: false, message: "Invalid wallet value" });
    }

    const newWalletAmount = walletNum + amtNum;

    await db.execute(
      `UPDATE users SET wallet = ? WHERE id = ?`,
      [newWalletAmount, userId]
    );

    req.log.info(
      { action: "user.update_wallet", userId, durationMs: Date.now() - start },
      "Wallet updated"
    );

    return res.status(200).json({
      success: true,
      message: "Wallet updated",
      data: { wallet: newWalletAmount },
    });

  } catch (error) {
    req.log.error(
      { action: "user.update_wallet", userId, message: error.message, stack: error.stack, durationMs: Date.now() - start },
      "Wallet update crashed"
    );

    return res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};


