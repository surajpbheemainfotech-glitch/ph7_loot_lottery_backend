import crypto from "crypto";
import {db} from '../config/db.js'

export const createOrder = async (req, res) => {
  const start = Date.now();
  const { amount, userId } = req.body;

  req.log.info(
    { action: "payment.order_create", userId, amount },
    "Create order request"
  );

  try {
    if (!amount || amount <= 0) {
      req.log.warn(
        { action: "payment.order_create", userId, amount, reason: "invalid_amount" },
        "Create order failed"
      );
      return res.status(400).json({ success: false, message: "Invalid amount" });
    }

    const orderId = "order_" + crypto.randomBytes(6).toString("hex");

    const fakeOrder = {
      id: orderId,
      amount: amount * 100,
      currency: "INR",
      status: "created",
    };

    req.log.info(
      {
        action: "payment.order_create",
        userId,
        orderId,
        amount,
        durationMs: Date.now() - start,
      },
      "Order created"
    );

    return res.json({
      success: true,
      order: fakeOrder,
      key: "DUMMY_KEY", 
    });
  } catch (err) {
    req.log.error(
      { action: "payment.order_create", userId, amount, err, durationMs: Date.now() - start },
      "Create order crashed"
    );
    return res.status(500).json({ success: false, message: "Order creation failed" });
  }
};

export const verifyPayment = async (req, res) => {
  const start = Date.now();
  const { order_id, payment_id, amount, userId, package_id } = req.body;

  req.log.info(
    {
      action: "payment.verify",
      userId,
      orderId: order_id,
      transactionId: payment_id,
      packageId: package_id,
      amount,
    },
    "Verify payment request"
  );

  try {
    if (!order_id || !payment_id) {
      req.log.warn(
        {
          action: "payment.verify",
          userId,
          orderId: order_id,
          transactionId: payment_id,
          reason: "missing_order_or_payment_id",
        },
        "Payment verify failed"
      );
      return res.status(400).json({ success: false, message: "Payment failed" });
    }

    if (!userId) {
      req.log.warn(
        { action: "payment.verify", reason: "missing_userId" },
        "Payment verify failed"
      );
      return res.status(400).json({ success: false, message: "userId is required" });
    }

    if (!package_id) {
      req.log.warn(
        { action: "payment.verify", userId, reason: "missing_package_id" },
        "Payment verify failed"
      );
      return res.status(400).json({ success: false, message: "package_id is required" });
    }

    const [found] = await db.execute(`SELECT * FROM users WHERE id = ?`, [userId]);

    if (!found.length) {
      req.log.warn(
        { action: "payment.verify", userId, reason: "user_not_found" },
        "Payment verify failed"
      );
      return res.status(404).json({ success: false, message: "User not found" });
    }

    await db.execute(
      `INSERT INTO user_packages (user_id, package_id, purchased_at)
       VALUES (?, ?, NOW())`,
      [userId, package_id]
    );

    await db.execute(`UPDATE users set wallet = ? WHERE id = ?`, [amount, userId]);

    req.log.info(
      {
        action: "payment.verify",
        userId,
        orderId: order_id,
        transactionId: payment_id,
        packageId: package_id,
        amount,
        durationMs: Date.now() - start,
      },
      "Payment verified and user updated"
    );

    return res.json({
      success: true,
      amount: amount ?? null,
      message: "✅ Dummy payment verified, user package updated",
    });
  } catch (err) {
    req.log.error(
      {
        action: "payment.verify",
        userId,
        orderId: order_id,
        transactionId: payment_id,
        packageId: package_id,
        err,
        durationMs: Date.now() - start,
      },
      "Payment verify crashed"
    );
    return res.status(500).json({ success: false, message: "Verification failed" });
  }
};

export const transferFund = async (req, res) => {
  const start = Date.now();
  const { userId, amount } = req.body;

  req.log.info(
    { action: "wallet.withdraw", userId, amount },
    "Withdraw request"
  );

  try {
    if (!userId || !amount) {
      req.log.warn(
        { action: "wallet.withdraw", userId, amount, reason: "missing_fields" },
        "Withdraw failed"
      );
      return res.status(400).json({ success: false, message: "userId and amount are required" });
    }

    if (amount <= 0) {
      req.log.warn(
        { action: "wallet.withdraw", userId, amount, reason: "invalid_amount" },
        "Withdraw failed"
      );
      return res.status(400).json({ success: false, message: "Amount must be greater than 0" });
    }

    const [rows] = await db.execute("SELECT wallet FROM users WHERE id = ?", [userId]);

    if (rows.length === 0) {
      req.log.warn(
        { action: "wallet.withdraw", userId, reason: "user_not_found" },
        "Withdraw failed"
      );
      return res.status(404).json({ success: false, message: "User not found" });
    }

    const currentBalance = Number(rows[0].wallet);

    if (currentBalance < amount) {
      req.log.warn(
        {
          action: "wallet.withdraw",
          userId,
          amount,
          currentBalance,
          reason: "insufficient_balance",
        },
        "Withdraw failed"
      );
      return res.status(400).json({ success: false, message: "Insufficient wallet balance" });
    }

    const newBalance = currentBalance - amount;

    await db.execute("UPDATE users SET wallet = ? WHERE id = ?", [newBalance, userId]);

    const payoutId = "payout_dummy_" + Date.now();

    const dummyRazorpayResponse = {
      payout_id: payoutId,
      status: "processed",
      amount,
      currency: "INR",
      mode: "bank_transfer",
    };

    req.log.info(
      {
        action: "wallet.withdraw",
        userId,
        payoutId,
        deducted: amount,
        remainingBalance: newBalance,
        durationMs: Date.now() - start,
      },
      "Withdraw successful"
    );

    return res.status(200).json({
      success: true,
      message: "Withdrawal successful (dummy)",
      razorpay: dummyRazorpayResponse,
      wallet: { deducted: amount, remainingBalance: newBalance },
    });
  } catch (err) {
    req.log.error(
      { action: "wallet.withdraw", userId, amount, err, durationMs: Date.now() - start },
      "Withdraw crashed"
    );
    return res.status(500).json({ success: false, message: "Server error" });
  }
};


