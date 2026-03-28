const getActiveCart = async (conn, userId) => {
  const [[cart]] = await conn.execute(
    `SELECT id FROM carts WHERE user_id = ? AND status='active' LIMIT 1`,
    [userId]
  );
  if (!cart) throw new Error("Cart not found");
  return cart;
};

export const getCartItems = async (conn, cartId) => {
  const [items] = await conn.execute(
    `SELECT ci.*, p.draw_number, p.title AS pool_name
     FROM cart_items ci
     JOIN pools p ON ci.pool_id = p.id
     WHERE ci.cart_id = ?`,
    [cartId]
  );
  if (!items.length) throw new Error("Cart is empty");
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
  let tickets = [];

  for (const item of items) {
    for (let i = 0; i < item.ticket_quantity; i++) {
      const ticketId = generateTicketId(item.pool_name);

      await conn.execute(
        `INSERT INTO tickets
        (id, user_id, user_number, ticket_amount, draw_number, pool_name, payment_status)
        VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          ticketId,
          userId,
          Math.floor(100000 + Math.random() * 900000),
          item.price_per_ticket,
          item.draw_number,
          item.pool_name,
          "SUCCESS",
        ]
      );

      tickets.push(ticketId);
    }
  }

  return tickets;
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