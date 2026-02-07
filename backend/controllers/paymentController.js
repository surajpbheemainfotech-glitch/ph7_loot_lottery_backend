import crypto from "crypto";
import {db} from '../config/db.js'

export const createOrder = async (req, res) => {
  try {
    const { amount, userId } = req.body;

    if (!amount || amount <= 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid amount",
      });
    }

    const fakeOrder = {
      id: "order_" + crypto.randomBytes(6).toString("hex"),
      amount: amount * 100,
      currency: "INR",
      status: "created",
    };

    return res.json({
      success: true,
      order: fakeOrder,
      key: "DUMMY_KEY", // 🔁 Razorpay key later
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: "Order creation failed",
    });
  }
};

export const verifyPayment = async (req, res) => {
  try {
    const { order_id, payment_id, amount, userId, package_id } = req.body;
     console.log(req.body)
    if (!order_id || !payment_id) {
      return res.status(400).json({
        success: false,
        message: "Payment failed",
      });
    }

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: "userId is required",
      });
    }

    if (!package_id) {
      return res.status(400).json({
        success: false,
        message: "package_id is required",
      });
    }

    const [found] = await db.execute(`SELECT * FROM users WHERE id = ?`, [userId]);

    if (!found.length) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }


   await db.execute(
  `INSERT INTO user_packages (user_id, package_id, purchased_at )
   VALUES (?, ?, NOW())`,
  [userId, package_id]
);

    await db.execute(
      `UPDATE users set wallet = ? WHERE id = ?`,
      [amount,userId]
    );

    return res.json({
      success: true,
      amount: amount ?? null,
      message: "✅ Dummy payment verified, user package updated",
    });
  } catch (err) {
    console.log(err);
    return res.status(500).json({
      success: false,
      message: "Verification failed",
    });
  }
};

