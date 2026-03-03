import { db } from "../../config/db.js";
import { logger } from "../../config/logger.js";
import { POOLS_LIST_KEY } from "../../redis/cache/pool.cache.js";
import { redisClient } from "../../redis/redisClient.js";
import { makeUniqueSlug } from "../../helper/pool.helper/slugGenerator.js";

export const createDailyPools = async () => {
  const start = Date.now();
  const ctx = { action: "pool.create_daily" };

  try {
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

    for (const template of templates) {
      const slug = await makeUniqueSlug(template.title);

      await db.execute(
        `
        INSERT INTO pools
        (title, price, jackpot, start_at, expire_at, status, imageurl, slug, created_at, updated_at)
        VALUES (?, ?, ?, NOW(), DATE_ADD(NOW(), INTERVAL 24 HOUR), 'active', ?, ?, NOW(), NOW())
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