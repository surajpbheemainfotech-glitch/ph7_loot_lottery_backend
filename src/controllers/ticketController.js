import { db } from "../config/db.js";
import generateTicketId from "../sevices/service.ticket/ticketIdGenerator.js";


export const buyCartTickets = async (req, res) => {
  const start = Date.now();
  const userId = req.user?.id;

  const ctx = { action: "cart.buy_all", userId };

  req.log.info(ctx, "Buy cart request");

  if (!userId) {
    req.log.warn({ ...ctx, reason: "unauthorized" });
    return res.status(403).json({ success: false, message: "Unauthorized" });
  }

  try {
    const result = await checkoutCartService(userId, req.log);

    req.log.info(
      { ...ctx, ...result.meta, durationMs: Date.now() - start },
      "Cart checkout success"
    );

    return res.status(200).json({
      success: true,
      message: "All tickets purchased successfully",
      ...result.response,
    });

  } catch (err) {
    req.log.error(
      { ...ctx, err, durationMs: Date.now() - start },
      "Cart checkout failed"
    );

    return res.status(500).json({
      success: false,
      message: err.message || "Checkout failed",
    });
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




