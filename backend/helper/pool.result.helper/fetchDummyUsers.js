export const fetchDummyUsers = async (conn, limit) => {
  const safeLimit = parseInt(limit, 10);
  if (!Number.isInteger(safeLimit) || safeLimit <= 0) {
    throw new Error("Valid limit is required");
  }

  const [users] = await conn.query(
    `SELECT id, title, first_name, last_name, email, wallet
     FROM users
     WHERE role = 'dummy_user'
     ORDER BY RAND()
     LIMIT ${safeLimit}`
  );

  return users;
};