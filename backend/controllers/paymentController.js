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

export const transferFund = async (req, res) => {
  try {
    const { userId, amount } = req.body;

    // 🔴 validation
    if (!userId || !amount) {
      return res.status(400).json({
        success: false,
        message: "userId and amount are required",
      });
    }

    if (amount <= 0) {
      return res.status(400).json({
        success: false,
        message: "Amount must be greater than 0",
      });
    }

    // 🔍 fetch user wallet
    const [rows] = await db.execute(
      "SELECT wallet FROM users WHERE id = ?",
      [userId]
    );

    if (rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    const currentBalance = Number(rows[0].wallet);

    // ❌ insufficient balance
    if (currentBalance < amount) {
      return res.status(400).json({
        success: false,
        message: "Insufficient wallet balance",
      });
    }

    // ✅ deduct wallet balance
    const newBalance = currentBalance - amount;

    await db.execute(
      "UPDATE users SET wallet = ? WHERE id = ?",
      [newBalance, userId]
    );

    // 🎭 dummy Razorpay payout response
    const dummyRazorpayResponse = {
      payout_id: "payout_dummy_" + Date.now(),
      status: "processed",
      amount,
      currency: "INR",
      mode: "bank_transfer",
    };

    return res.status(200).json({
      success: true,
      message: "Withdrawal successful (dummy)",
      razorpay: dummyRazorpayResponse,
      wallet: {
        deducted: amount,
        remainingBalance: newBalance,
      },
    });
  } catch (error) {
    console.error("Withdraw error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};


