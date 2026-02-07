import { db } from "../config/db.js";
import generateTicketId from "../helper/ticketIdGenerator.js";


export const buyTicket = async (req, res) => {
  const connection = await db.getConnection();

  try {
    const {
      pool_name,
      user_number,
      ticket_amount,
      draw_number,
      payment_status,
      user_id,
    } = req.body;

    const userId = req.user?.id || user_id;

    if (!userId || !pool_name || !user_number || !ticket_amount || !draw_number) {
      return res.status(400).json({
        success: false,
        message: "All ticket details are required",
      });
    }

    /* 🔁 START TRANSACTION */
    await connection.beginTransaction();

    /* 🔐 Fetch wallet securely */
    const [[user]] = await connection.execute(
      "SELECT wallet FROM users WHERE id = ? FOR UPDATE",
      [userId]
    );

    if (!user) {
      await connection.rollback();
      return res.status(400).json({
        success: false,
        message: "User not found",
      });
    }

    if (user.wallet < ticket_amount) {
      await connection.rollback();
      return res.status(400).json({
        success: false,
        message: "Insufficient wallet balance",
      });
    }

    /* 🎟️ Insert Ticket (retry on duplicate) */
    let ticket_id;
    let inserted = false;

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
      }
    }

    /* 💰 Update wallet */
    const updatedWallet = user.wallet - ticket_amount;

    await connection.execute(
      `UPDATE users SET wallet = ? WHERE id = ?`,
      [updatedWallet, userId]
    );

    /* ✅ COMMIT */
    await connection.commit();

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
  } catch (error) {
    await connection.rollback();
    console.error("Buy ticket error:", error);

    return res.status(500).json({
      success: false,
      message: "Ticket purchase failed. Please try again.",
    });
  } finally {
    connection.release();
  }
};

export const deleteTicketByStatus = async (req, res) => {
  try {

    const [result] = await db.execute(
      "DELETE FROM tickets WHERE status = ?",
      ["expired"]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: "No expired tickets found to delete",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Expired tickets deleted successfully",
      deletedCount: result.affectedRows,
    });

  } catch (error) {
    console.error(error);
    return res.status(500).json({
      success: false,
      message: "Server error while deleting expired tickets",
    });
  }
};




