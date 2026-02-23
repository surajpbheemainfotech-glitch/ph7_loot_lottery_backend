import { db } from "../../config/db.js";
import { logger } from "../../config/logger.js";
import {POOLS_LIST_KEY} from "../../redis/cache/pool.cache.js"
import {redisClient } from '../../redis/redisClient.js'

export const updatePoolStatus = async () => {
  const start = Date.now();
  const ctx = { action: "pool.status_expire" };

  try {
    const [result] = await db.execute(`
      UPDATE pools
      SET status = 'expired'
      WHERE expire_at < NOW()
        AND status != 'expired'
    `);

    const affected = result?.affectedRows ?? 0;

     if (affected > 0) {
      try {
        await redisClient.del(POOLS_LIST_KEY);
      } catch (e) {
        logger.warn({ ...ctx, e }, "Redis invalidate failed");
      }
    }


    logger.info(
      { ...ctx, affectedRows: affected, durationMs: Date.now() - start },
      "Pool expired status updated"
    );

    return affected;
  } catch (err) {
    logger.error(
      { ...ctx, err, durationMs: Date.now() - start },
      "Pool expire status update failed"
    );
    return 0;
  }
};

export const deleteExpirePool = async () => {
  const start = Date.now();
  const ctx = { action: "pool.delete_expired_safe" };

  try {
    const [result] = await db.execute(`
      DELETE p
      FROM pools p
      INNER JOIN results r ON r.pool_id = p.id
      WHERE p.status = 'expired'
    `);

    const affected = result?.affectedRows ?? 0;

    if (affected === 0) {
      logger.info({ ...ctx, durationMs: Date.now() - start }, "No expired pools to delete");
      return 0;
    }
    if (affected > 0) {
      try {
        await redisClient.del(POOLS_LIST_KEY);
      } catch (e) {
        logger.warn({ ...ctx, e }, "Redis invalidate failed");
      }
    } else {
      logger.info({ ...ctx, durationMs: Date.now() - start }, "No expired pools to delete");
      return 0;
    }

    logger.info(
      { ...ctx, affectedRows: affected, durationMs: Date.now() - start },
      "Expired pools deleted (safe)"
    );

    return affected;
  } catch (err) {
    logger.error(
      { ...ctx, err, durationMs: Date.now() - start },
      "Expired pool delete failed"
    );
    return 0;
  }
};