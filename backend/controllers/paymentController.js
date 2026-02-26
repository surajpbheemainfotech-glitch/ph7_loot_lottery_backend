import crypto from "crypto";
import {db} from '../config/db.js'
import Razorpay from "../config/razurpayConfig.js";

export const createOrder = async (req, res) => {
  const start = Date.now();
  const { amount, userId, currency = "INR" } = req.body;

  req.log?.info?.({ action: "payment.order_create", userId, amount }, "Create order request");

  try {
    if (!userId) {
      return res.status(400).json({ success: false, message: "userId is required" });
    }

    if (!amount || Number(amount) <= 0) {
      req.log?.warn?.(
        { action: "payment.order_create", userId, amount, reason: "invalid_amount" },
        "Create order failed"
      );
      return res.status(400).json({ success: false, message: "Invalid amount" });
    }

    const receipt = `receipt_${Date.now()}`;

    const options = {
      amount: Math.round(Number(amount) * 100),
      currency,
      receipt,
    };

   
    const order = await Razorpay.orders.create(options);

    await db.query(
      `INSERT INTO payments (user_id, razorpay_order_id, amount, currency, status, receipt)
       VALUES (?, ?, ?, ?, 'created', ?)`,
      [userId, order.id, order.amount, order.currency, receipt]
    );

    req.log?.info?.(
      { action: "payment.order_create", userId, orderId: order.id, durationMs: Date.now() - start },
      "Order created"
    );

    return res.json({ success: true, order, message: "Order created" });
  } catch (err) {
    req.log?.error?.(
      { action: "payment.order_create", userId, amount, err, durationMs: Date.now() - start },
      "Create order crashed"
    );
    return res.status(500).json({ success: false, message: "Order creation failed" });
  }
};

export const verifyPayment = async (req, res) => {
  const start = Date.now();
  const {
    razorpay_order_id,
    razorpay_payment_id,
    razorpay_signature,
    userId,
    package_id,
  } = req.body;

  req.log?.info?.(
    { action: "payment.verify", userId, packageId: package_id },
    "Verify payment request"
  );

  if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
    req.log?.warn?.(
      {
        action: "payment.verify",
        userId,
        orderId: razorpay_order_id,
        transactionId: razorpay_payment_id,
        reason: "missing_fields",
      },
      "Payment verify failed"
    );
    return res.status(400).json({ success: false, message: "Missing payment fields" });
  }

  if (!userId) return res.status(400).json({ success: false, message: "userId is required" });
  if (!package_id) return res.status(400).json({ success: false, message: "package_id is required" });

  // 1) Verify signature
  const body = `${razorpay_order_id}|${razorpay_payment_id}`;
  const expectedSignature = crypto
    .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
    .update(body)
    .digest("hex");

  if (expectedSignature !== razorpay_signature) {
    await db.query(`UPDATE payments SET status='failed' WHERE razorpay_order_id=?`, [
      razorpay_order_id,
    ]);

    req.log?.warn?.(
      {
        action: "payment.verify",
        userId,
        orderId: razorpay_order_id,
        transactionId: razorpay_payment_id,
        reason: "invalid_signature",
      },
      "Payment verify failed"
    );

    return res.status(400).json({ success: false, message: "Invalid signature" });
  }

  // 2) Transaction: mark paid + attach package + wallet update
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    const [payRows] = await conn.execute(
      `SELECT id, amount, status FROM payments WHERE razorpay_order_id = ? FOR UPDATE`,
      [razorpay_order_id]
    );

    if (!payRows.length) {
      await conn.rollback();
      return res.status(404).json({ success: false, message: "Order not found in DB" });
    }

    const payment = payRows[0];

    if (payment.status === "paid") {
      await conn.commit();
      return res.json({ success: true, message: "Already verified", amount: payment.amount });
    }

    const [userRows] = await conn.execute(`SELECT id, wallet FROM users WHERE id = ?`, [userId]);
    if (!userRows.length) {
      await conn.rollback();
      return res.status(404).json({ success: false, message: "User not found" });
    }

    await conn.execute(
      `UPDATE payments
       SET razorpay_payment_id=?, razorpay_signature=?, status='paid'
       WHERE razorpay_order_id=?`,
      [razorpay_payment_id, razorpay_signature, razorpay_order_id]
    );

    await conn.execute(
      `INSERT INTO user_packages (user_id, package_id, purchased_at)
       VALUES (?, ?, NOW())`,
      [userId, package_id]
    );

    await conn.execute(
      `UPDATE users SET wallet = wallet + ? WHERE id = ?`,
      [payment.amount, userId]
    );

    await conn.commit();

    req.log?.info?.(
      {
        action: "payment.verify",
        userId,
        orderId: razorpay_order_id,
        transactionId: razorpay_payment_id,
        packageId: package_id,
        amount: payment.amount,
        durationMs: Date.now() - start,
      },
      "Payment verified and user updated"
    );

    return res.json({
      success: true,
      amount: payment.amount,
      message: "Payment verified, package updated",
    });
  } catch (err) {
    await conn.rollback();
    req.log?.error?.(
      {
        action: "payment.verify",
        userId,
        orderId: razorpay_order_id,
        transactionId: razorpay_payment_id,
        packageId: package_id,
        err,
        durationMs: Date.now() - start,
      },
      "Payment verify crashed"
    );
    return res.status(500).json({ success: false, message: "Verification failed" });
  } finally {
    conn.release();
  }
};

export const requestWithdrawAmount = async (req, res) => {
  const start = Date.now();
  const { userId, amount, method, upi_id, bank_account, ifsc, account_holder } = req.body;

  req.log.info(
    { action: "withdraw.request.start", userId, amount, method },
    "Withdraw request initiated"
  );

  try {
    if (!userId || amount == null || !method) {
      req.log.warn(
        { action: "withdraw.request.validation_failed", userId, amount },
        "Missing required fields"
      );
      return res.status(400).json({ success: false, message: "Required fields missing" });
    }

    const amt = Number(amount);
    if (!Number.isFinite(amt) || amt <= 0) {
      req.log.warn(
        { action: "withdraw.request.invalid_amount", userId, amount },
        "Invalid withdraw amount"
      );
      return res.status(400).json({ success: false, message: "Invalid amount" });
    }

    const [user] = await db.execute("SELECT id FROM users WHERE id=?", [userId]);
    if (!user.length) {
      req.log.warn(
        { action: "withdraw.request.user_not_found", userId },
        "User not found"
      );
      return res.status(404).json({ success: false, message: "User not found" });
    }

    const [result] = await db.execute(
      `INSERT INTO withdraw_requests 
       (user_id, amount, method, upi_id, bank_account, ifsc, account_holder, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'PENDING')`,
      [
        userId,
        amt,
        method,
        method === "upi" ? upi_id : null,
        method === "bank" ? bank_account : null,
        method === "bank" ? ifsc : null,
        method === "bank" ? account_holder : null,
      ]
    );

    req.log.info(
      {
        action: "withdraw.request.created",
        userId,
        withdrawId: result.insertId,
        durationMs: Date.now() - start,
      },
      "Withdraw request stored"
    );

    return res.status(201).json({
      success: true,
      withdrawId: result.insertId,
      message: "Request sent to admin",
    });
  } catch (err) {
    req.log.error(
      {
        action: "withdraw.request.crashed",
        userId,
        amount,
        error: err.message,
        durationMs: Date.now() - start,
      },
      "Withdraw request crashed"
    );
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

export const getAllWithdrawRequests = async (req, res) => {
  const start = Date.now();

  req.log?.info(
    { action: "withdraw.admin.getall.start" },
    "Fetch withdraw_requests started"
  );

  try {
    const [rows] = await db.execute("SELECT * FROM withdraw_requests");

    req.log?.info(
      {
        action: "withdraw.admin.getall.success",
        count: rows.length,
        durationMs: Date.now() - start,
      },
      "Fetch withdraw_requests success"
    );

    return res.status(200).json({
      success: true,
      message: "Withdraw requests fetched",
      count: rows.length,
      data: rows,
    });
  } catch (err) {
    req.log?.error(
      {
        action: "withdraw.admin.getall.crashed",
        error: err?.message,
        stack: err?.stack,
        durationMs: Date.now() - start,
      },
      "Fetch withdraw_requests crashed"
    );

    return res.status(500).json({ success: false, message: "Server error" });
  }
};

export const approveWithdrawRequest = async (req, res) => {
  const start = Date.now();
  const { withdrawId, adminId } = req.body;

  req.log?.info(
    { action: "withdraw.approve.start", withdrawId, adminId },
    "Admin approval started"
  );

  try {
    if (!withdrawId || !adminId) {
      return res.status(400).json({
        success: false,
        message: "withdrawId and adminId required",
      });
    }

    const [admin] = await db.execute(
      "SELECT id, status FROM admin WHERE id=?",
      [adminId]
    );

    const [rows] = await db.execute(
      "SELECT id, status FROM withdraw_requests WHERE id=?",
      [withdrawId]
    );

    if(!admin.length){
       return res.status(404).json({ success: false, message: "Access denied" });
    }

    if (!rows.length ) {
      return res.status(404).json({ success: false, message: "Request not found" });
    }

    if (rows[0].status !== "PENDING") {
      return res.status(400).json({
        success: false,
        message: `Already ${rows[0].status}`,
      });
    }

    await db.execute(
      `UPDATE withdraw_requests 
       SET status='APPROVED'
       WHERE id=?`,
      [ withdrawId]
    );

    req.log?.info(
      {
        action: "withdraw.approve.success",
        withdrawId,
        durationMs: Date.now() - start,
      },
      "Withdraw approved"
    );

    return res.json({ success: true, message: "Withdraw approved" });
  } catch (err) {
    req.log?.error(
      { action: "withdraw.approve.crashed", error: err.message },
      "Approve crashed"
    );
    return res.status(500).json({ success: false });
  }
};

export const executeWithdrawPayout = async (req, res) => {
  const start = Date.now();
  const { withdrawId } = req.body;

  const conn = await db.getConnection();

  req.log?.info({ action: "withdraw.execute.start", withdrawId }, "Execute payout started");

  try {
    if (!withdrawId) {
      req.log?.warn(
        { action: "withdraw.execute.validation_failed", withdrawId },
        "withdrawId missing"
      );
      return res.status(400).json({ success: false, message: "withdrawId required" });
    }

    await conn.beginTransaction();

    // 1) lock withdraw request
    const [reqRows] = await conn.execute(
      "SELECT * FROM withdraw_requests WHERE id=? FOR UPDATE",
      [withdrawId]
    );

    if (!reqRows.length) {
      await conn.rollback();
      req.log?.warn({ action: "withdraw.execute.not_found", withdrawId }, "Request not found");
      return res.status(404).json({ success: false, message: "Request not found" });
    }

    const wr = reqRows[0];

    // 2) status check
    if (wr.status !== "APPROVED") {
      await conn.rollback();
      req.log?.warn(
        { action: "withdraw.execute.invalid_status", withdrawId, status: wr.status },
        "Request not approved"
      );
      return res
        .status(400)
        .json({ success: false, message: `Request must be APPROVED (current ${wr.status})` });
    }

    // 3) lock user
    const [users] = await conn.execute(
      "SELECT id, wallet, name, email, phone FROM users WHERE id=? FOR UPDATE",
      [wr.user_id]
    );

    if (!users.length) {
      await conn.rollback();
      req.log?.warn(
        { action: "withdraw.execute.user_not_found", userId: wr.user_id },
        "User not found"
      );
      return res.status(404).json({ success: false, message: "User not found" });
    }

    const user = users[0];
    const amt = Number(wr.amount);
    const wallet = Number(user.wallet || 0);

    if (!Number.isFinite(amt) || amt <= 0) {
      await conn.rollback();
      req.log?.warn(
        { action: "withdraw.execute.invalid_amount", withdrawId, amount: wr.amount },
        "Invalid withdraw amount"
      );
      return res.status(400).json({ success: false, message: "Invalid withdraw amount" });
    }

    // 4) wallet check
    if (wallet < amt) {
      await conn.execute(
        "UPDATE withdraw_requests SET status='FAILED', failure_reason=? WHERE id=?",
        ["Insufficient wallet balance at payout time", withdrawId]
      );

      await conn.commit();

      req.log?.warn(
        { action: "withdraw.execute.insufficient_wallet", withdrawId, wallet, amt },
        "Insufficient wallet"
      );

      return res.status(400).json({ success: false, message: "Insufficient wallet balance" });
    }

    // 5) mark processing + deduct wallet
    await conn.execute("UPDATE withdraw_requests SET status='PROCESSING' WHERE id=?", [withdrawId]);
    await conn.execute("UPDATE users SET wallet = wallet - ? WHERE id=?", [amt, wr.user_id]);

    // 6) payout payload
    const idempotencyKey = crypto.randomUUID();

    const payoutPayload =
      wr.method === "bank"
        ? {
            account_number: process.env.RZP_X_ACCOUNT_NUMBER,
            amount: Math.round(amt * 100),
            currency: "INR",
            mode: "IMPS",
            purpose: "payout",
            queue_if_low_balance: true,
            reference_id: `withdraw_${withdrawId}`,
            narration: "Withdrawal",
            fund_account: {
              account_type: "bank_account",
              bank_account: {
                name: wr.account_holder,
                ifsc: wr.ifsc,
                account_number: wr.bank_account,
              },
              contact: {
                name: user.name || "User",
                email: user.email || undefined,
                contact: user.phone || undefined,
                type: "customer",
                reference_id: `user_${wr.user_id}`,
              },
            },
          }
        : {
            account_number: process.env.RZP_X_ACCOUNT_NUMBER,
            amount: Math.round(amt * 100),
            currency: "INR",
            mode: "UPI",
            purpose: "payout",
            queue_if_low_balance: true,
            reference_id: `withdraw_${withdrawId}`,
            narration: "Withdrawal",
            fund_account: {
              account_type: "vpa",
              vpa: { address: wr.upi_id },
              contact: {
                name: user.name || "User",
                email: user.email || undefined,
                contact: user.phone || undefined,
                type: "customer",
                reference_id: `user_${wr.user_id}`,
              },
            },
          };

    req.log?.info(
      {
        action: "withdraw.execute.payout_call",
        withdrawId,
        idempotencyKey,
        amount: amt,
        method: wr.method,
      },
      "Calling Razorpay payout"
    );

    // 7) call payout
    let payout;
    try {
      payout = await Razorpay.payouts.create(payoutPayload, {
        headers: {
          "X-Payout-Idempotency": idempotencyKey,
        },
      });
    } catch (apiErr) {
      // payout fail => refund wallet + mark FAILED
      await conn.execute("UPDATE users SET wallet = wallet + ? WHERE id=?", [amt, wr.user_id]);
      await conn.execute(
        "UPDATE withdraw_requests SET status='FAILED', failure_reason=? WHERE id=?",
        [apiErr?.message || "Payout API failed", withdrawId]
      );

      await conn.commit();

      req.log?.error(
        {
          action: "withdraw.execute.payout_failed",
          withdrawId,
          error: apiErr?.message,
          durationMs: Date.now() - start,
        },
        "Razorpay payout failed"
      );

      return res.status(500).json({ success: false, message: "Payout failed", error: apiErr?.message });
    }

    // 8) success => mark success
    await conn.execute(
      "UPDATE withdraw_requests SET status='SUCCESS', razorpay_payout_id=? WHERE id=?",
      [payout.id, withdrawId]
    );

    await conn.commit();

    req.log?.info(
      {
        action: "withdraw.execute.success",
        withdrawId,
        payoutId: payout.id,
        remainingBalance: wallet - amt,
        durationMs: Date.now() - start,
      },
      "Withdraw executed successfully"
    );

    return res.json({
      success: true,
      message: "Withdraw payout initiated",
      data: { withdrawId, payoutId: payout.id, payoutStatus: payout.status },
      wallet: { deducted: amt, remainingBalance: wallet - amt },
    });
  } catch (err) {
    try {
      await conn.rollback();
    } catch {}

    req.log?.error(
      {
        action: "withdraw.execute.crashed",
        withdrawId,
        error: err?.message,
        durationMs: Date.now() - start,
      },
      "Withdraw execute crashed"
    );

    return res.status(500).json({ success: false, message: "Server error", error: err?.message });
  } finally {
    conn.release();
  }
};