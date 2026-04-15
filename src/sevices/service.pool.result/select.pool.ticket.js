
export const checkPoolExpired = async (conn, poolId, logger) => {

  const [rows] = await conn.execute(
    `SELECT id, title, jackpot, expire_at
     FROM pools
     WHERE id=?
     FOR UPDATE`,
    [poolId]
  );

  if (!rows.length) {
    logger.warn({ poolId }, "Pool not found");
    throw new Error("Pool not found");
  }

  const pool = rows[0];

  if (new Date(pool.expires_at) > new Date()) {
    logger.warn({ poolId }, "Pool not expired yet");
    throw new Error("Pool not expired");
  }

  logger.info({ poolId }, "Pool expiration validated");

  return pool;
};

export const loadPoolTickets = async (conn, poolId, logger) => {

  const [tickets] = await conn.execute(
    `SELECT id, user_id, ticket_number
     FROM tickets
     WHERE pool_id=?`,
    [poolId]
  );

  logger.info(
    { poolId, ticketCount: tickets.length },
    "Pool tickets loaded"
  );

  return tickets;
};