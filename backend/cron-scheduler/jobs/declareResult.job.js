import { db } from "../../config/db.js";
import { declareResultForPool } from "../services/result.service.js";

export const declareResultsJob = async () => {
  // Fetch expired pools that don't have result yet
  const [pools] = await db.execute(
    `SELECT p.id, p.title, p.jackpot
     FROM pools p
     LEFT JOIN results r ON r.pool_id = p.id
     WHERE p.status = 'expired'
       AND r.id IS NULL`
  );

  if (!pools.length) {
    console.log("🟦 No expired pools pending result declaration");
    return { processed: 0, success: 0, failed: 0 };
  }

  let success = 0;
  let failed = 0;

  for (const pool of pools) {
    try {
      const out = await declareResultForPool(pool);

      if (out?.skipped) {
        console.log(`⏭️ Skipped ${pool.title} (${out.reason})`);
      } else {
        console.log(`🏁 Result declared for ${pool.title} (resultId=${out.resultId})`);
        success++;
      }
    } catch (e) {
      failed++;
      console.error(`❌ Failed declaring ${pool.title}:`, e.message);
    }
  }

  return { processed: pools.length, success, failed };
};
