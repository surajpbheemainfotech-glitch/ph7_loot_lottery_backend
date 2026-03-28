export const checkoutCartService = async (userId, log) => {
  const connection = await db.getConnection();

  try {
    await connection.beginTransaction();

    const cart = await getActiveCart(connection, userId);
    const items = await getCartItems(connection, cart.id);

    const totalAmount = calculateTotal(items);

    const user = await getUserForUpdate(connection, userId);

    if (user.wallet < totalAmount) {
      throw new Error("Insufficient balance");
    }

    const tickets = await createTicketsFromCart(connection, items, userId);

    const updatedWallet = user.wallet - totalAmount;

    await updateWallet(connection, userId, updatedWallet);
    await clearCart(connection, cart.id);

    await connection.commit();

    return {
      meta: {
        cartId: cart.id,
        totalAmount,
        ticketsCount: tickets.length,
      },
      response: {
        tickets,
        wallet_left: updatedWallet,
      },
    };

  } catch (err) {
    await connection.rollback();
    throw err;
  } finally {
    connection.release();
  }
};