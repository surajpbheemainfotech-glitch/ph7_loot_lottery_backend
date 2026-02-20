import { db } from "../config/db.js";
import generateTicketId from "../helper/ticket.helper/ticketIdGenerator.js";


export const buyTicket = async (req, res) => {
  const connection = await db.getConnection();
  const start = Date.now();

  const {
    pool_name,
    user_number,
    ticket_amount,
    draw_number,
    payment_status,
    user_id,
  } = req.body;

  const userId = req.user?.id || user_id;

  // helpful context for every log line in this request
  const ctx = {
    action: "ticket.buy",
    userId,
    poolName: pool_name,
    drawNumber: draw_number,
    ticketAmount: ticket_amount,
  };

  req.log.info(ctx, "Buy ticket request");

  try {
    if (!userId || !pool_name || !user_number || !ticket_amount || !draw_number) {
      req.log.warn({ ...ctx, reason: "missing_fields" }, "Buy ticket failed");
      return res.status(400).json({
        success: false,
        message: "All ticket details are required",
      });
    }

    await connection.beginTransaction();
    req.log.info(ctx, "DB transaction started");

    // 🔐 lock wallet row
    const [[user]] = await connection.execute(
      "SELECT wallet FROM users WHERE id = ? FOR UPDATE",
      [userId]
    );

    if (!user) {
      await connection.rollback();
      req.log.warn({ ...ctx, reason: "user_not_found" }, "Buy ticket failed");
      return res.status(400).json({ success: false, message: "User not found" });
    }

    const wallet = Number(user.wallet);

    if (wallet < ticket_amount) {
      await connection.rollback();
      req.log.warn(
        { ...ctx, wallet, reason: "insufficient_balance" },
        "Buy ticket failed"
      );
      return res.status(400).json({
        success: false,
        message: "Insufficient wallet balance",
      });
    }

    let ticket_id;
    let inserted = false;
    let retries = 0;

    while (!inserted) {
      try {
        ticket_id = generateTicketId(pool_name);

        await connection.execute(
          `INSERT INTO tickets
           (id, user_id, user_number, ticket_amount, draw_number, pool_name, payment_status)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [
            ticket_id,
            userId,
            user_number,
            ticket_amount,
            draw_number,
            pool_name,
            payment_status || "SUCCESS",
          ]
        );

        inserted = true;
      } catch (err) {
        if (err.code !== "ER_DUP_ENTRY") throw err;
        retries += 1;
        req.log.warn(
          { ...ctx, ticketId: ticket_id, retries, reason: "duplicate_ticket_id" },
          "Ticket id collision, retrying"
        );
      }
    }

    const updatedWallet = wallet - ticket_amount;

    await connection.execute(
      `UPDATE users SET wallet = ? WHERE id = ?`,
      [updatedWallet, userId]
    );

    await connection.commit();

    req.log.info(
      {
        ...ctx,
        ticketId: ticket_id,
        walletBefore: wallet,
        walletAfter: updatedWallet,
        retries,
        durationMs: Date.now() - start,
      },
      "Ticket purchased"
    );

    return res.status(201).json({
      success: true,
      message: "🎉 Ticket purchased successfully",
      ticket: {
        ticket_id,
        pool_name,
        draw_number,
        ticket_amount,
        wallet_left: updatedWallet,
        purchased_at: new Date().toISOString(),
      },
    });
  } catch (err) {
    try {
      await connection.rollback();
    } catch (rbErr) {
      req.log.error(
        { ...ctx, err: rbErr },
        "Rollback failed (warning)"
      );
    }

    req.log.error(
      { ...ctx, err, durationMs: Date.now() - start },
      "Buy ticket crashed"
    );

    return res.status(500).json({
      success: false,
      message: "Ticket purchase failed. Please try again.",
    });
  } finally {
    connection.release();
  }
};

export const deleteTicketByStatus = async (req, res) => {
  const start = Date.now();
  const ctx = { action: "ticket.delete_expired" };

  req.log.info(ctx, "Delete expired tickets request");

  try {
    const [result] = await db.execute(
      "DELETE FROM tickets WHERE status = ?",
      ["expired"]
    );

    if (result.affectedRows === 0) {
      req.log.warn({ ...ctx, reason: "none_found" }, "No expired tickets to delete");
      return res.status(404).json({
        success: false,
        message: "No expired tickets found to delete",
      });
    }

    req.log.info(
      { ...ctx, deletedCount: result.affectedRows, durationMs: Date.now() - start },
      "Expired tickets deleted"
    );

    return res.status(200).json({
      success: true,
      message: "Expired tickets deleted successfully",
      deletedCount: result.affectedRows,
    });
  } catch (err) {
    req.log.error(
      { ...ctx, err, durationMs: Date.now() - start },
      "Delete expired tickets crashed"
    );
    return res.status(500).json({
      success: false,
      message: "Server error while deleting expired tickets",
    });
  }
};




