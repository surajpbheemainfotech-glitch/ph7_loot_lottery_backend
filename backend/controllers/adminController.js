import { db } from "../config/db.js";
import JWT from 'jsonwebtoken'
import bcrypt from "bcryptjs"
import {createOtp} from "../helper/otp.helper/otpService.js"
import buildForgotPasswordOtpEmail from "../helper/nodeMailer.helper/otpEmailBuilder.js"
import sendEmail from "../helper/nodeMailer.helper/sendEmail.js"
import {verifyOtp} from "../helper/otp.helper/otpService.js"

export const loginController = async (req, res) => {
  const start = Date.now();
  const { email } = req.body;

  req.log.info(
    { action: "admin.login", email },
    "Login attempt"
  );

  try {
    const { email, password } = req.body;

    if (!email || !password) {
      req.log.warn(
        { action: "admin.login", email, reason: "missing_credentials" },
        "Login failed"
      );
      return res.json({ success: false, message: "Credential are required" });
    }

    const [rows] = await db.execute(
      "SELECT id, email, password , role FROM admin WHERE email = ?",
      [email]
    );

    if (rows.length === 0) {
      req.log.warn(
        { action: "admin.login", email, reason: "admin_not_found" },
        "Login failed"
      );
      return res.status(401).json({
        success: false,
        message: "Invalid email or password",
      });
    }

    const user = rows[0];

    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      req.log.warn(
        { action: "admin.login", adminId: user.id, reason: "wrong_password" },
        "Login failed"
      );
      return res.status(401).json({ success: false, message: "Invalid email or password" });
    }

    const token = JWT.sign(
      { userId: user.id, email: user.email, role: user.role },
      process.env.ADMIN_JWT_SECRET,
      { expiresIn: "1d" }
    );

    res.cookie("admin_token", token, {
      httpOnly: true,
      secure: false,
      sameSite: "lax",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    req.log.info(
      { action: "admin.login", adminId: user.id, role: user.role, durationMs: Date.now() - start },
      "Login successful"
    );

    return res.status(200).json({
      success: true,
      message: "Login successful",
      token,
      admin: { id: user.id, email: user.email, role: user.role },
    });
  } catch (err) {
    req.log.error(
      { action: "admin.login", err, durationMs: Date.now() - start },
      "Login crashed"
    );
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

export const forgetPasswordByAdminEmail = async (req, res) => {
  const start = Date.now();
  const { email } = req.body;

  req.log.info({ action: "admin.forgot_password", email }, "Forgot password request");

  try {
    if (!email) {
      req.log.warn(
        { action: "admin.forgot_password", reason: "missing_email" },
        "Forgot password failed"
      );
      return res.status(400).json({ success: false, message: "Enter valid email" });
    }

    const [existingAdmin] = await db.execute(
      `SELECT * from admin where email= ?`,
      [email]
    );

    if (existingAdmin.length === 0) {
      req.log.warn(
        { action: "admin.forgot_password", email, reason: "admin_not_found" },
        "Forgot password failed"
      );
      return res.status(400).json({ success: false, message: "Enter valid email" });
    }

    const admin = existingAdmin[0];

    const { otp, ttlMinutes } = await createOtp({
      email,
      purpose: "admin_forgot_password",
      ttlMinutes: 5,
    });

    req.log.info(
      { action: "admin.forgot_password", adminId: admin.id, ttlMinutes },
      "OTP generated"
    );

    const { subject, html, text } = buildForgotPasswordOtpEmail({
      name: admin.name || "Admin",
      otp,
      role: "admin",
      expiryMinutes: ttlMinutes,
    });

    await sendEmail({ to: email, subject, html, text });

    req.log.info(
      { action: "admin.forgot_password", adminId: admin.id, durationMs: Date.now() - start },
      "OTP email sent"
    );

    return res.status(200).json({
      success: true,
      message: "OTP sent successfully",
    });
  } catch (err) {
    req.log.error(
      { action: "admin.forgot_password", err, durationMs: Date.now() - start },
      "Forgot password crashed"
    );
    return res.status(500).json({ success: false, message: "Something went wrong" });
  }
};

export const verifyForgotPasswordAdminOtp = async (req, res) => {
  const start = Date.now();
  const { email } = req.body;

  req.log.info({ action: "admin.otp_verify", email }, "OTP verify attempt");

  try {
    const { otp } = req.body;

    if (!email || !otp) {
      req.log.warn(
        { action: "admin.otp_verify", email, reason: "missing_email_or_otp" },
        "OTP verify failed"
      );
      return res.status(400).json({ success: false, message: "Email and OTP are required" });
    }

    const [existingAdmin] = await db.execute(
      `SELECT id FROM admin WHERE email = ? LIMIT 1`,
      [email]
    );

    if (existingAdmin.length === 0) {
      req.log.warn(
        { action: "admin.otp_verify", email, reason: "admin_not_found" },
        "OTP verify failed"
      );
      return res.status(400).json({ success: false, message: "Invalid request" });
    }

    const adminId = existingAdmin[0].id;

    const result = await verifyOtp({
      email,
      purpose: "admin_forgot_password",
      otp, 
    });

    if (!result.ok) {
      req.log.warn(
        { action: "admin.otp_verify", adminId, reason: "invalid_or_expired_otp" },
        "OTP verify failed"
      );
      return res.status(400).json({ success: false, message: "Invalid or expired OTP" });
    }

    req.log.info(
      { action: "admin.otp_verify", adminId, durationMs: Date.now() - start },
      "OTP verified"
    );

    return res.status(200).json({ success: true, message: "OTP verified successfully" });
  } catch (err) {
    req.log.error(
      { action: "admin.otp_verify", err, durationMs: Date.now() - start },
      "OTP verify crashed"
    );
    return res.status(500).json({ success: false, message: "Something went wrong" });
  }
};

export const resetPasswordAdmin = async (req, res) => {
  const start = Date.now();
  const { email } = req.body;

  req.log.info({ action: "admin.password_reset", email }, "Password reset attempt");

  try {
    const { newPassword } = req.body;

    if (!email || !newPassword) {
      req.log.warn(
        { action: "admin.password_reset", email, reason: "missing_email_or_newPassword" },
        "Password reset failed"
      );
      return res.status(400).json({ success: false, message: "Email and new password are required" });
    }

    if (newPassword.length < 6) {
      req.log.warn(
        { action: "admin.password_reset", email, reason: "password_too_short" },
        "Password reset failed"
      );
      return res.status(400).json({ success: false, message: "Password must be at least 6 characters" });
    }

    const [existingAdmin] = await db.execute(
      `SELECT id FROM admin WHERE email = ? LIMIT 1`,
      [email]
    );

    if (existingAdmin.length === 0) {
      req.log.warn(
        { action: "admin.password_reset", email, reason: "admin_not_found" },
        "Password reset failed"
      );
      return res.status(400).json({ success: false, message: "Invalid request" });
    }

    const adminId = existingAdmin[0].id;

    const hashedPassword = await bcrypt.hash(newPassword, 10);

    await db.execute(
      `UPDATE admin SET password = ? WHERE email = ?`,
      [hashedPassword, email]
    );

    req.log.info(
      { action: "admin.password_reset", adminId, durationMs: Date.now() - start },
      "Password reset successful"
    );

    return res.status(200).json({ success: true, message: "Password reset successfully" });
  } catch (err) {
    req.log.error(
      { action: "admin.password_reset", err, durationMs: Date.now() - start },
      "Password reset crashed"
    );
    return res.status(500).json({ success: false, message: "Something went wrong" });
  }
};