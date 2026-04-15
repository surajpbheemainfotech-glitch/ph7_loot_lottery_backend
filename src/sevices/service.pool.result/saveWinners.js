import { calculatePrizeAmount } from "./calculatePrizeAmount.js";


export const saveWinners = async (
  conn,
  pool,
  winners,
  logger
) => {

  const [resultInsert] = await conn.execute(
    `INSERT INTO results
     (pool_id,pool_title,jackpot,declared_at,created_at)
     VALUES (?,?,?,NOW(),NOW())`,
    [pool.id, pool.title, pool.jackpot]
  );

  const resultId = resultInsert.insertId;

  for (const w of winners) {

    const prize =
      calculatePrizeAmount(pool.jackpot, w.position);

    await conn.execute(
      `INSERT INTO result_winners
       (result_id,user_id,position,prize_amount)
       VALUES (?,?,?,?)`,
      [resultId, w.user_id, w.position, prize]
    );
  }

  logger.info(
    { resultId },
    "Result winners saved"
  );

  return {
    resultId,
    winners
  };
};