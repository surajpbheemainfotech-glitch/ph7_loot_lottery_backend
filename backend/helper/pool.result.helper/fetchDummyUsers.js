import {
  addDummyUserFeilds,
  DUMMY_USER_LIST_KEY,
  DUMMY_USER_TTL_SECONDS
} from '../../redis/cache/dummy-user.cache.js'

export const fetchDummyUsers = async (conn, limit) => {
  const safeLimit = parseInt(limit, 10);
  if (!Number.isInteger(safeLimit) || safeLimit <= 0) {
    throw new Error("Valid limit is required");
  }

  //check cache

  try {
    const cached = await redisClient.get(DUMMY_USER_LIST_KEY);

    if (cached) {
      const rawRows = JSON.parse(cached);
      const rows = addDummyUserFeilds(rawRows)

      req.log.info(
        { action: "dummy_user.list", source: "redis", count: rows.length, durationMs: Date.now() - start },
        "Pools fetched (cache hit)"
      )

      return res.status(200).json({ success: true, count: rows.length, data: rows, cached: true })
    }
    req.log.info({ action: "dummy_user.list", source: "redis" }, "Cache miss");

  } catch (redisErr) {
    req.log.warn({ action: "dummy_user.list", redisErr }, "Redis read failed, falling back to DB");
  }


  const [users] = await conn.query(
    `SELECT id, title, first_name, last_name, email, wallet
     FROM users
     WHERE role = 'dummy_user'
     ORDER BY RAND()
     LIMIT ${safeLimit}`
  );


  // Save cache

  try {
    await redisClient.set(DUMMY_USER_LIST_KEY, JSON.stringify(users), { EX: DUMMY_USER_TTL_SECONDS })
  } catch (redisErr) {
    req.log.warn({ action: "dummy_user.list", redisErr }, "Redis write failed (continuing without cache)");
  }

  return users;
};