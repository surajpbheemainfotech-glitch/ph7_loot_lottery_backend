import { db } from "../config/db.js";
import JWT from 'jsonwebtoken'
import bcrypt from "bcryptjs"
import {createOtp} from "../helper/otp.helper/otpService.js"
import buildForgotPasswordOtpEmail from "../helper/nodeMailer.helper/otpEmailBuilder.js"
import sendEmail from "../helper/nodeMailer.helper/sendEmail.js"
import {verifyOtp} from "../helper/otp.helper/otpService.js"

export const loginController = async (req, res) => {
console.log("...")
    try {
        const { email, password } = req.body

        if (!email || !password) {
            return res.json({ success: false, message: "Credential are required" })
        }

        const [rows] = await db.execute(
            "SELECT id, email, password , role FROM admin WHERE email = ?",
            [email]
        );

        if (rows.length === 0) {
            return res.status(401).json({
                success: false,
                message: "Invalid email or password",
            });
        }

        const user = rows[0]

        const isMatch = password == user.password

        if (!isMatch) {
            return res.json({ success: false, message: "Invalid email or password" })
        }

        const token = JWT.sign(
            { userId: user.id, email: user.email, role: user.role },
            process.env.ADMIN_JWT_SECRET,
            { expiresIn: "1d" }
        )



        res.cookie("admin_token", token, {
            httpOnly: true,
            secure: false,
            sameSite: "lax",
            maxAge: 7 * 24 * 60 * 60 * 1000
        });
        return res.status(200).json({
            success: true,
            message: "Login successful",
            token,
            admin: {
                id: user.id,
                email: user.email,
                role: user.role
            },
        });


    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Server error",
            error: error.message,
        });

    }


}

export const forgetPasswordByAdminEmail = async (req, res) => {
    try {

        const { email } = req.body

        if (!email) {
            return res.status(400).json({ success: false, message: "Enter valid email" })
        }

        const [existingAdmin] = await db.execute(`SELECT * from admin where email= ?`, [email])

        if (existingAdmin.length == 0) {
            return res.status(400).json({ success: false, message: "Enter valid email" })
        }

        const admin = existingAdmin[0]

        // create otp first step

        const { otp, ttlMinutes } = await createOtp({
            email,
            purpose: "admin_forgot_password",
            ttlMinutes: 5,
        });


        // Build email template for forgetpassword 

        const { subject, html, text } = buildForgotPasswordOtpEmail({
            name: admin.name || "Admin",
            otp,
            role: "admin",
            expiryMinutes: ttlMinutes,
        });

        // Send Email

        await sendEmail({
            to: email,
            subject,
            html,
            text,
        });

        return res.status(200).json({
            success: true,
            message: "OTP sent successfully",
        });
    } catch (error) {
        console.error("Forget Password Admin Error:", error);
        return res.status(500).json({
            success: false,
            message: "Something went wrong",
        });
    }

}

export const verifyForgotPasswordAdminOtp = async (req, res) => {

    try {
        const { email, otp } = req.body;

        if (!email || !otp) {
            return res.status(400).json({
                success: false,
                message: "Email and OTP are required",
            });
        }

        const [existingAdmin] = await db.execute(
            `SELECT id FROM admin WHERE email = ? LIMIT 1`,
            [email]
        );

        if (existingAdmin.length === 0) {
            return res.status(400).json({
                success: false,
                message: "Invalid request",
            });
        }

        // Verify OTP with hepler 

        const result = await verifyOtp({
            email,
            purpose: "admin_forgot_password",
            otp,
        });


        if (!result.ok) {
            return res.status(400).json({
                success: false,
                message: "Invalid or expired OTP",
            });
        }

        return res.status(200).json({
            success: true,
            message: "OTP verified successfully",
        });

    } catch (error) {
        console.error("Verify Admin OTP Error:", error);
        return res.status(500).json({
            success: false,
            message: "Something went wrong",
        });
    }
}

export const resetPasswordAdmin = async (req, res) => {
    try {
        const { email, newPassword } = req.body;

        if (!email || !newPassword) {
            return res.status(400).json({
                success: false,
                message: "Email and new password are required",
            });
        }

        if (newPassword.length < 6) {
            return res.status(400).json({
                success: false,
                message: "Password must be at least 6 characters",
            });
        }

        const [existingAdmin] = await db.execute(
            `SELECT id FROM admin WHERE email = ? LIMIT 1`,
            [email]
        );

        if (existingAdmin.length === 0) {
            return res.status(400).json({
                success: false,
                message: "Invalid request",
            });
        }

        // Hash new password
        const hashedPassword = await bcrypt.hash(newPassword, 10);

        // Update password
        await db.execute(
            `UPDATE admin SET password = ? WHERE email = ?`,
            [hashedPassword, email]
        );

        return res.status(200).json({
            success: true,
            message: "Password reset successfully",
        });

    } catch (error) {
        console.error("Reset Admin Password Error:", error);
        return res.status(500).json({
            success: false,
            message: "Something went wrong",
        });
    }
}