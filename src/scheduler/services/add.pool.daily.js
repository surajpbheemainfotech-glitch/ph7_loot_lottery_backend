import { db } from "../../config/db.js";
import { logger } from "../../config/loggers.js";
import { POOLS_LIST_KEY } from "../../redis/cache/pool.cache.js";
import { redisClient } from "../../redis/redisClient.js";
import { makeUniqueSlug } from "../../sevices/service.pool/slugGenerator.js";

export const createDailyPools = async () => {
  const start = Date.now();
  const ctx = { action: "pool.create_daily" };

  try {

    const [existing] = await db.execute(`
    SELECT COUNT(*) as count
    FROM pools
    WHERE DATE(start_at) = CURDATE()
  `);

  if (existing[0].count > 0) {
    return 0; // already created today
  }

    const [templates] = await db.execute(`
      SELECT id, title, price, jackpot, imageurl
      FROM pool_templates
      WHERE status = 'active'
    `);

    if (!templates.length) {
      logger.info({ ...ctx }, "No active templates found");
      return 0;
    }

    let createdCount = 0;

    const expireInterval =
  process.env.NODE_ENV === "production"
    ? "24 HOUR"
    : "2 MINUTE";

    for (const template of templates) {
      const slug = await makeUniqueSlug(template.title);

      await db.execute(
        `
        INSERT INTO pools
        (title, price, jackpot, start_at, expire_at, status, imageurl, slug, created_at, updated_at)
        VALUES (?, ?, ?, NOW(),DATE_ADD(NOW(), INTERVAL ${expireInterval}), 'active', ?, ?, NOW(), NOW())
        `,
        [
          template.title,
          template.price,
          template.jackpot,
          template.imageurl,
          slug
        ]
      );

      createdCount++;
    }

    if (createdCount > 0) {
      try {
        await redisClient.del(POOLS_LIST_KEY);
      } catch (e) {
        logger.warn({ ...ctx, e }, "Redis invalidate failed");
      }
    }

    logger.info(
      { ...ctx, created: createdCount, durationMs: Date.now() - start },
      "Daily pools created successfully"
    );

    return createdCount;

  } catch (err) {
    logger.error(
      { ...ctx, err, durationMs: Date.now() - start },
      "Daily pool creation failed"
    );
    return 0;
  }
};