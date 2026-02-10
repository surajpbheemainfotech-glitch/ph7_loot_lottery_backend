import { db } from "../../config/db.js";

export const updatePoolStatus = async () => {
  try {
    const [result] = await db.execute(`
      UPDATE pools
      SET status = 'expired'
      WHERE expire_at < NOW()
        AND status != 'expired'
    `);

    console.log(`✅ Pools expired status updated: ${result.affectedRows}`);
    return result.affectedRows;
  } catch (error) {
    console.error("❌ Pool expire update error:", error);
    return 0;
  }
};

// ✅ Safe delete: only delete expired pools whose result exists
export const deleteExpirePool = async () => {
  try {
    const [result] = await db.execute(`
      DELETE p
      FROM pools p
      INNER JOIN results r ON r.pool_id = p.id
      WHERE p.status = 'expired'
    `);

    if (result.affectedRows === 0) {
      console.log("🟦 No expired pools found to delete (safe delete)");
    }

    console.log(`🗑️ Expired pools deleted (safe): ${result.affectedRows}`);
    return result.affectedRows;
  } catch (error) {
    console.error("❌ Pool delete error:", error);
    return 0;
  }
};
