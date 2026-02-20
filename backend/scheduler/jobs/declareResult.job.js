import { db } from "../../config/db.js";
import { logger } from "../../config/logger.js";
import { declareResultForPool } from "../services/result.service.js";

export const declareResultsJob = async () => {
  const start = Date.now();
  const ctx = { action: "job.declare_results" };

  logger.info(ctx, "Declare results job started");

  let pools = [];
  try {
    const [rows] = await db.execute(
      `SELECT p.id, p.title, p.jackpot
       FROM pools p
       LEFT JOIN results r ON r.pool_id = p.id
       WHERE p.status = 'expired'
         AND r.id IS NULL`
    );
    pools = rows || [];
  } catch (err) {
    logger.error({ ...ctx, err }, "Failed to fetch pools pending result declaration");
    throw err;
  }

  if (!pools.length) {
    logger.info(
      { ...ctx, processed: 0, durationMs: Date.now() - start },
      "No expired pools pending result declaration"
    );
    return { processed: 0, success: 0, skipped: 0, failed: 0 };
  }

  logger.info(
    { ...ctx, pendingPools: pools.length },
    "Pools pending result declaration"
  );

  let success = 0;
  let failed = 0;
  let skipped = 0;

  for (const pool of pools) {
    const poolCtx = { ...ctx, poolId: pool.id, title: pool.title };

    try {
      const out = await declareResultForPool(pool);

      if (out?.skipped) {
        skipped++;
        logger.info(
          { ...poolCtx, skipped: true, reason: out.reason },
          "Result declaration skipped"
        );
      } else {
        success++;
        logger.info(
          { ...poolCtx, resultId: out?.resultId, prizePool: out?.prize_pool },
          "Result declared"
        );
      }
    } catch (err) {
      failed++;
      logger.error(
        { ...poolCtx, err },
        "Result declaration failed"
      );
    }
  }

  const summary = {
    processed: pools.length,
    success,
    skipped,
    failed,
    durationMs: Date.now() - start,
  };

  if (failed > 0) {
    logger.warn({ ...ctx, ...summary }, "Declare results job completed with failures");
  } else {
    logger.info({ ...ctx, ...summary }, "Declare results job completed successfully");
  }

  return summary;
};