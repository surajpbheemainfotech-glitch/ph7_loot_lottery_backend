import { db } from '../config/db.js'

export const addToCart = async (req, res) => {
  const start = Date.now();
  const conn = await db.getConnection();

  const userId = req.user?.userId;
  const { pool_id, tickets } = req.body;

  console.log(tickets)

  req.log.info(
    { action: "cart.add.start", userId, pool_id, ticketCount: tickets?.length, tickets },
    "Add to cart request"
  );

  if (!userId) {
    req.log.warn({ action: "cart.add.unauthorized" });
    return res.status(403).json({
      success: false,
      message: "Unauthorized"
    });
  }

  if (!pool_id || !tickets?.length) {
    req.log.warn(
      { action: "cart.add.validation_failed", pool_id, tickets },
      "Invalid request payload"
    );

    return res.status(400).json({
      success: false,
      message: "Missing required fields"
    });
  }

  try {

    await conn.beginTransaction();

    req.log.debug({ action: "cart.transaction.start" });

    const [[pool]] = await conn.execute(
      `SELECT price FROM pools WHERE id=?`,
      [pool_id]
    );

    if (!pool) {

      await conn.rollback();

      req.log.warn(
        { action: "cart.pool.not_found", pool_id },
        "Pool not found"
      );

      return res.status(404).json({
        success: false,
        message: "Pool not found"
      });
    }

    const ticketPrice = pool.price;

    let [[cart]] = await conn.execute(
      `SELECT id FROM carts 
       WHERE user_id=? AND status='active' 
       LIMIT 1`,
      [userId]
    );

    let cartId;

    if (!cart) {

      const [newCart] = await conn.execute(
        `INSERT INTO carts (user_id,total_amount) VALUES (?,0)`,
        [userId]
      );

      cartId = newCart.insertId;
      req.log.info({ action: "cart.created", cartId });

    } else {

      cartId = cart.id;
      req.log.debug({ action: "cart.reused", cartId });
    }

    let [[item]] = await conn.execute(
      `SELECT id FROM cart_items
       WHERE cart_id=? AND pool_id=?`,
      [cartId, pool_id]
    );

    let itemId;

    if (!item) {

      const [newItem] = await conn.execute(
        `INSERT INTO cart_items (cart_id, pool_id, ticket_price)
         VALUES (?,?,?)`,
        [cartId, pool_id, ticketPrice,]
      );

      itemId = newItem.insertId;

      req.log.info(
        { action: "cart.item.created", itemId },
        "Cart item created"
      );

    } else {

      itemId = item.id;
      req.log.debug(
        { action: "cart.item.exists", itemId }
      );
    }

    const ticketsJson = JSON.stringify(tickets);

    await conn.execute(
      `INSERT INTO cart_tickets
        (cart_item_id, ticket_name, ticket_number, ticket_price)
        SELECT ?, jt.ticket_display, jt.ticket_number, jt.ticket_price
        FROM JSON_TABLE(
        CAST(? AS JSON),
       '$[*]'
        COLUMNS(
         ticket_display VARCHAR(255) PATH '$.ticket_display',
         ticket_number INT PATH '$.ticket_number',
         ticket_price DECIMAL(10,2) PATH '$.ticket_price'
       )
       ) jt`,
      [itemId, ticketsJson]
    );

    req.log.info(
      { action: "cart.tickets.inserted", ticketCount: tickets.length },
      "Tickets inserted"
    );

    const totalIncrease = ticketPrice * tickets.length;

    await conn.execute(
      `UPDATE carts
       SET total_amount = total_amount + ?
       WHERE id=?`,
      [totalIncrease, cartId]
    );

    await conn.commit();

    req.log.info(
      {
        action: "cart.add.success",
        cartId,
        durationMs: Date.now() - start
      },
      "Add to cart successful"
    );

    return res.status(200).json({
      success: true,
      message: "Tickets added to cart"
    });

  } catch (error) {

    await conn.rollback();

    req.log.error(
      {
        action: "cart.add.failed",
        error,
        durationMs: Date.now() - start
      },
      "Add to cart failed"
    );

    return res.status(500).json({
      success: false,
      message: "Server error"
    });

  } finally {

    conn.release();
    req.log.debug(
      { action: "cart.connection.released" },
      "DB connection released"
    );
  }
};

export const removeFromCart = async (req, res) => {
  const start = Date.now();
  const conn = await db.getConnection();

  const userId = req.user?.userId;
  const { pool_id } = req.body;

  req.log.info(
    { action: "cart.remove.start", userId, pool_id },
    "Remove from cart request"
  );

  if (!userId) {
    req.log.warn({ action: "cart.remove", reason: "unauthorized" });
    return res.status(403).json({ success: false, message: "Unauthorized." });
  }

  if (!pool_id) {
    req.log.warn({ action: "cart.remove", reason: "missing_pool_id" });
    return res.status(400).json({ success: false, message: "pool_id required." });
  }

  try {

    await conn.beginTransaction();

    const [[cart]] = await conn.execute(
      `SELECT id,total_amount 
       FROM carts 
       WHERE user_id=? AND status='active'
       LIMIT 1`,
      [userId]
    );

    if (!cart) {

      await conn.rollback();

      req.log.warn({ action: "cart.remove", reason: "cart_not_found" });

      return res.status(404).json({
        success: false,
        message: "Cart not found"
      });
    }

    const cartId = cart.id;

    const [[item]] = await conn.execute(
      `SELECT id, ticket_price
       FROM cart_items
       WHERE cart_id=? AND pool_id=?`,
      [cartId, pool_id]
    );

    if (!item) {

      await conn.rollback();

      req.log.warn(
        { action: "cart.remove", cartId, pool_id, reason: "item_not_found" }
      );

      return res.status(404).json({
        success: false,
        message: "Item not found"
      });
    }

    const [[ticketCount]] = await conn.execute(
      `SELECT COUNT(*) AS count
       FROM cart_tickets
       WHERE cart_item_id=?`,
      [item.id]
    );

    const totalDecrease = item.ticket_price * ticketCount.count;

    await conn.execute(
      `DELETE FROM cart_items
       WHERE id=?`,
      [item.id]
    );

    const newTotal = cart.total_amount - totalDecrease;

    if (newTotal <= 0) {

      await conn.execute(`DELETE FROM carts WHERE id=?`, [cartId]);

      req.log.info(
        { action: "cart.deleted", cartId },
        "Cart removed (empty)"
      );

    } else {

      await conn.execute(
        `UPDATE carts
         SET total_amount=?
         WHERE id=?`,
        [newTotal, cartId]
      );
    }

    await conn.commit();

    req.log.info(
      {
        action: "cart.remove.success", cartId, newTotal, durationMs: Date.now() - start
      },
      "Item removed from cart"
    );

    return res.json({
      success: true,
      message: "Item removed from cart"
    });

  } catch (error) {

    await conn.rollback();

    req.log.error(
      {
        action: "cart.remove.failed", error, durationMs: Date.now() - start
      }
    );

    return res.status(500).json({
      success: false,
      message: "Server error"
    });

  } finally {
    conn.release();
  }
};

export const getCart = async (req, res) => {

  const start = Date.now();
  const userId = req.user?.userId;

  req.log.info({ action: "cart.get.start", userId });

  if (!userId) {
    return res.status(403).json({
      success: false,
      message: "Unauthorized"
    });
  }

  try {

    const [[cart]] = await db.execute(
      `SELECT id,total_amount
       FROM carts
       WHERE user_id=? AND status='active'
       LIMIT 1`,
      [userId]
    );

    if (!cart) {

      req.log.info(
        { action: "cart.get.empty", durationMs: Date.now() - start }
      );

      return res.json({
        success: true,
        cart: null,
        items: []
      });
    }

    const cartId = cart.id;

    const [items] = await db.execute(
      `SELECT
        ci.id,
        ci.pool_id,
        p.title AS pool_title,
        ci.ticket_price,

        COUNT(ct.id) AS ticket_quantity,

        JSON_ARRAYAGG(
          JSON_OBJECT(
            'ticket_name', ct.ticket_name,
            'ticket_number', ct.ticket_number
          )
        ) AS tickets

      FROM cart_items ci
      JOIN pools p ON ci.pool_id = p.id
      LEFT JOIN cart_tickets ct ON ct.cart_item_id = ci.id
      WHERE ci.cart_id=?
      GROUP BY ci.id
      ORDER BY ci.created_at ASC`,
      [cartId]
    );

    req.log.info(
      {
        action: "cart.get.success",
        cartId,
        itemCount: items.length,
        durationMs: Date.now() - start
      }
    );

    return res.json({
      success: true,
      cart: {
        id: cartId,
        total_amount: cart.total_amount
      },
      items
    });

  } catch (error) {

    req.log.error(
      {
        action: "cart.get.failed",
        error,
        durationMs: Date.now() - start
      }
    );

    return res.status(500).json({
      success: false,
      message: "Server error"
    });
  }
};