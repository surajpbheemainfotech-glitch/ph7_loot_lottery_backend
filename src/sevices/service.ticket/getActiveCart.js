import generateTicketId from "./ticketIdGenerator.js";

export const getActiveCart = async (conn, userId) => {
  const [[cart]] = await conn.execute(
    `SELECT id FROM carts WHERE user_id = ? AND status='active' LIMIT 1`,
    [userId]
  );
  if (!cart) throw new Error("Cart not found");
  return cart;
};

export const getCartItems = async (conn, cartId) => {

  const [rows] = await conn.execute(
    `SELECT
    ci.id,
    ci.pool_id,
    p.title AS pool_name,
    ci.ticket_price,

    COUNT(ct.id) AS ticket_quantity,
    (COUNT(ct.id) * ci.ticket_price) AS total_price,

    JSON_ARRAYAGG(
      JSON_OBJECT(
        'ticket_name', ct.ticket_name,
        'ticket_number', ct.ticket_number
      )
    ) AS tickets

FROM cart_items ci
JOIN pools p ON p.id = ci.pool_id
JOIN cart_tickets ct ON ct.cart_item_id = ci.id
WHERE ci.cart_id = ?
GROUP BY ci.id
ORDER BY ci.created_at ASC`,
    [cartId]
  );

  if (!rows.length) {
    throw new Error("Cart is empty");
  }

  const items = rows.map(row => ({
    ...row,
    tickets: typeof row.tickets === "string"
      ? JSON.parse(row.tickets)
      : row.tickets
  }));


  return items;
};

export const calculateTotal = (items) =>
  items.reduce(
    (sum, i) => sum + i.ticket_quantity * i.price_per_ticket,
    0
  );

export const getUserForUpdate = async (conn, userId) => {
  const [[user]] = await conn.execute(
    `SELECT wallet FROM users WHERE id = ? FOR UPDATE`,
    [userId]
  );
  if (!user) throw new Error("User not found");
  return user;
};

export const createTicketsFromCart = async (conn, items, userId) => {

  console.dir(items, { depth: null });

  if (!Array.isArray(items) || items.length === 0) {
    throw new Error("Cart is empty");
  }

  const createdTickets = [];

  for (const item of items) {

    if (!Array.isArray(item.tickets) || item.tickets.length === 0) {
      continue;
    }

    const price = item.ticket_price ?? 0; // ✅ FIX HERE

    for (const ticket of item.tickets) {

      if (!ticket || ticket.ticket_number == null) {
        continue;
      }

      await conn.execute(
        `INSERT INTO tickets
        (user_id, ticket_amount, ticket_number, pool_name, payment_status)
        VALUES (?, ?, ?, ?, ?)`,
        [
          userId,
          price,                         // ✅ FIXED
          ticket.ticket_number,         // ✅ FIXED
          item.pool_name,
          "paid"
        ]
      );

      createdTickets.push(ticket.ticket_number);
    }
  }

  if (!createdTickets.length) {
    throw new Error("Cart is empty");
  }

  return createdTickets;
};

export const updateWallet = async (conn, userId, amount) => {
  await conn.execute(
    `UPDATE users SET wallet = ? WHERE id = ?`,
    [amount, userId]
  );
};

export const clearCart = async (conn, cartId) => {
  await conn.execute(`DELETE FROM cart_items WHERE cart_id = ?`, [cartId]);
  await conn.execute(`DELETE FROM carts WHERE id = ?`, [cartId]);
};