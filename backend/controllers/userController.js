import bcrypt from 'bcryptjs'
import JWT from 'jsonwebtoken'
import { db } from '../config/db.js'

export const register = async (req, res) => {
  console.log("front")
  try {
    const { title, first_name, last_name, email, password } = req.body;
    const role = "user"

    if (!email || !password || !title || !first_name || !last_name) {
      return res.status(400).json({
        success: false,
        message: "Credentials are required",
      });
    }

    const [rows] = await db.execute(
      "SELECT id FROM users WHERE email = ?",
      [email]
    );

    // ✅ FIXED condition
    if (rows.length !== 0) {
      return res.status(409).json({
        success: false,
        message: "User already exists",
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const [result] = await db.execute(
      `INSERT INTO users (title, first_name, last_name, email, password, role)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [title, first_name, last_name, email, hashedPassword, role]
    );

    const user = {
      id: result.insertId,
      email,
      role: role,
    };

    const token = JWT.sign(
      { id: user.id, email: user.email, role: user.role },
      process.env.USER_JWT_SECRET,
      { expiresIn: "7d" }
    );


    // ✅ cookie set
    res.cookie("user_token", token, {
      httpOnly: true,
      secure: false,
      sameSite: "lax",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    return res.status(201).json({
      success: true,
      token,
      message: "Register successful",
      user: {
        id: result.insertId,   // ✅ NEW USER ID
        title,
        first_name,
        last_name,
        email,
      },
    });

  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });

  }
};


export const login = async (req, res) => {

  console.log("front")
  try {
    const { email, password } = req.body

    if (!email || !password) {
      return res.json({ success: false, message: "Credential are required" })
    }

    const [rows] = await db.execute(
      "SELECT id,title, first_name, last_name, email, password FROM users WHERE email = ?",
      [email]
    );


    if (rows.length === 0) {
      return res.status(401).json({
        success: false,
        message: "User not found",
      });
    }
    const user = rows[0]

    const isMatch = await bcrypt.compare(password, user.password)

    if (!isMatch) {
      return res.status(400).json({ success: false, message: "Invalid email or password" })
    }

    const token = JWT.sign(
      { userId: user.id, email: user.email },
      process.env.USER_JWT_SECRET,
      { expiresIn: "1d" }
    )

    res.cookie("user_token", token, {
      httpOnly: true,
      secure: false,
      sameSite: "lax",
      maxAge: 7 * 24 * 60 * 60 * 1000
    });

    return res.status(200).json({
      success: true,
      message: "Login successful",
      token,
      user: {
        id: user.id,
        first_name: user.first_name,
        last_name: user.last_name,
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


export const userDetailsById = async (req, res) => {
  try {
    const userId = req.params.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "User not logged in",
      });
    }

    const [userRows] = await db.execute(
      `SELECT id, title, first_name, last_name, email, role
       FROM users
       WHERE id = ?`,
      [userId]
    );

    if (userRows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    const user = userRows[0];

    const [packageRows] = await db.execute(
      `SELECT
          up.id AS user_package_id,
          up.user_id,
          up.package_id,
          up.purchased_at,
          p.package_name,
          p.package_price
       FROM user_packages up
       JOIN packages p ON p.id = up.package_id
       WHERE up.user_id = ?
       ORDER BY up.purchased_at DESC`,
      [userId]
    );

    if (packageRows.length === 0) {
      return res.status(409).json({
        success: false,
        message: "Please select your plan",
      });
    }

    const [ticketRows] = await db.execute(
      `SELECT id, user_number, ticket_amount, draw_number, pool_name, payment_status
       FROM tickets
       WHERE user_id = ?`,
      [userId]
    );

    const tickets = ticketRows.length ? ticketRows : null;

    return res.status(200).json({
      success: true,
      message: "User Profile",
      data: {
        user,
        package: packageRows,
        tickets,
      },
    });
  } catch (error) {
    console.error("userDetailsById error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};


