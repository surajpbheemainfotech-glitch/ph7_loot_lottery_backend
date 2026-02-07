import { db } from "../config/db.js";
import JWT from 'jsonwebtoken'

export const loginController = async (req, res) => {

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

export const forgetPasswordAdmin = async(req,res) =>{
    
}