import { db } from "../../config/db.js";
import { logger } from "../../config/loggers.js";

import { buildUserSnapshot } from "../../sevices/service.pool.result/buildUserSnapshot.js";
import { determineRealWinnerRules } from "../../sevices/service.pool.result/determineRealWinnerRules.js";
import { getRealUsers } from "../../sevices/service.pool.result/getRealUsers.js";
import { saveWinners } from "../../sevices/service.pool.result/saveWinners.js";
import { checkPoolExpired, loadPoolTickets } from "../../sevices/service.pool.result/select.pool.ticket.js";
import { selectWinners } from "../../sevices/service.pool.result/selectWinners.js";

export const declareResultForPool = async ({ id: poolId }) => {

  const start = Date.now();
  const ctx = { action: "result.declare", poolId };

  const conn = await db.getConnection();

  try {

    logger.info(ctx, "Result declaration started");

    await conn.beginTransaction();

    const pool = await checkPoolExpired(conn, poolId, logger);

    const tickets = await loadPoolTickets(conn, poolId, logger);

    const { realUsers, realUserCount } = getRealUsers(tickets, logger);

    const { dummyUsers, totalUsers } =
      await buildUserSnapshot(conn, realUsers, logger);

    const rules =
      determineRealWinnerRules(realUserCount, totalUsers, logger);

    const winners =
      await selectWinners(
        tickets,
        realUsers,
        dummyUsers,
        rules,
        logger
      );

    const result =
      await saveWinners(
        conn,
        pool,
        winners,
        logger
      );

    await conn.commit();

    logger.info(
      { ...ctx, durationMs: Date.now() - start },
      "Result declaration completed"
    );

    return result;

  } catch (err) {

    await conn.rollback();

    logger.error(
      { ...ctx, err },
      "Result declaration failed"
    );

    throw err;

  } finally {
    conn.release();
  }
};