import {
  addDummyUserFeilds,
  DUMMY_USER_LIST_KEY,
  DUMMY_USER_TTL_SECONDS
} from "../../redis/cache/dummy-user.cache.js";

import { redisClient } from "../../redis/redisClient.js";

export const fetchDummyUsers = async (conn, limit, logger) => {

  const start = Date.now();

  const safeLimit = parseInt(limit, 10);

  if (!Number.isInteger(safeLimit) || safeLimit <= 0) {
    throw new Error("Valid limit is required");
  }

  try {

    const cached = await redisClient.get(DUMMY_USER_LIST_KEY);

    if (cached) {

      const rawRows = JSON.parse(cached);
      const rows = addDummyUserFeilds(rawRows);

      logger?.info(
        {
          action: "dummy_user.fetch",
          source: "redis",
          count: rows.length,
          durationMs: Date.now() - start
        },
        "Dummy users fetched from cache"
      );

      return { data: rows, cached: true };
    }

    logger?.info(
      { action: "dummy_user.fetch", source: "redis" },
      "Dummy user cache miss"
    );

  } catch (redisErr) {

    logger?.warn(
      { action: "dummy_user.fetch", redisErr },
      "Redis read failed, fallback to DB"
    );
  }

  const [users] = await conn.query(
    `SELECT id,title,first_name,last_name,email,wallet
     FROM users
     WHERE role='dummy_user'
     ORDER BY RAND()
     LIMIT ?`,
    [safeLimit]
  );

  try {

    await redisClient.set(
      DUMMY_USER_LIST_KEY,
      JSON.stringify(users),
      { EX: DUMMY_USER_TTL_SECONDS }
    );

  } catch (redisErr) {

    logger?.warn(
      { action: "dummy_user.fetch", redisErr },
      "Redis write failed"
    );
  }

  logger?.info(
    {
      action: "dummy_user.fetch",
      source: "database",
      count: users.length,
      durationMs: Date.now() - start
    },
    "Dummy users fetched from DB"
  );

  return { data: users, cached: false };
};