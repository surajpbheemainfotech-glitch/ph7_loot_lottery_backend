import { db } from "../../config/db.js";
import { logger } from "../../config/logger.js";

import { fetchDummyUsers } from "../../helper/pool.result.helper/fetchDummyUsers.js";
import { pickWinners } from "../../helper/pool.result.helper/pickWinners.js";
import { sortWinners } from "../../helper/pool.result.helper/sortWinners.js";
import { calculatePrizeAmount } from "../../helper/pool.result.helper/calculatePrizeAmount.js";
import { winnerDetails } from "../../helper/pool.result.helper/winnerDetails.js";

export const declareResultForPool = async ({ id: poolId, title, jackpot }) => {
  const start = Date.now();

  if (!poolId || !title) {
    logger.warn(
      { action: "result.declare", poolId, title, reason: "missing_poolId_or_title" },
      "Declare result input invalid"
    );
    throw new Error("poolId and title are required");
  }

  const conn = await db.getConnection();

  const ctx = { action: "result.declare", poolId, title };

  logger.info(ctx, "Declare result started");

  try {
    await conn.beginTransaction();
    logger.info(ctx, "DB transaction started");

    const [poolLock] = await conn.execute(
      `SELECT id, title, jackpot
       FROM pools
       WHERE id = ?
       FOR UPDATE`,
      [poolId]
    );

    if (!poolLock.length) {
      logger.warn({ ...ctx, reason: "pool_not_found" }, "Declare result failed");
      throw new Error("pool not found");
    }

    const totalPrize = Number(poolLock[0].jackpot ?? jackpot ?? 0);

  
    const [existingResult] = await conn.execute(
      `SELECT id FROM results WHERE pool_id = ? LIMIT 1`,
      [poolId]
    );

    if (existingResult.length) {
      await conn.rollback();

      logger.info(
        { ...ctx, skipped: true, reason: "already_declared", existingResultId: existingResult[0].id, durationMs: Date.now() - start },
        "Declare result skipped (already declared)"
      );

      return { skipped: true, reason: "already_declared", poolId, title };
    }

    const [resultInsert] = await conn.execute(
      `INSERT INTO results (pool_id, pool_title, jackpot, declared_at, created_at)
       VALUES (?, ?, ?, NOW(), NOW())`,
      [poolId, title, totalPrize]
    );

    const resultId = resultInsert.insertId;

    logger.info(
      { ...ctx, resultId, prizePool: totalPrize },
      "Result row inserted"
    );

    const [realRows] = await conn.execute(
      `SELECT DISTINCT user_id
       FROM tickets
       WHERE pool_name = ?`,
      [title]
    );

    let realUserIds = realRows.map((r) => r.user_id);
    if (realUserIds.length > 100) realUserIds = realUserIds.slice(0, 100);

    const remaining = 100 - realUserIds.length;
    let dummyUserIds = [];

    if (remaining > 0) {
      const dummyUsers = await fetchDummyUsers(conn, remaining * 2);
      dummyUserIds = dummyUsers
        .map((u) => u.id)
        .filter((id) => !realUserIds.includes(id))
        .slice(0, remaining);
    }

    const final100 = [...realUserIds, ...dummyUserIds].slice(0, 100);

    logger.info(
      {
        ...ctx,
        resultId,
        realUsersUsed: realUserIds.length,
        dummyUsersUsed: dummyUserIds.length,
        totalUsersSnapshot: final100.length,
      },
      "Result users selected"
    );

    if (final100.length) {
      const values = final100.map((uid) => [resultId, uid, new Date()]);
      await conn.query(
        `INSERT INTO result_users (result_id, user_id, created_at) VALUES ?`,
        [values]
      );
    }

    const [tickets] = await conn.execute(
      `SELECT id AS ticket_id, user_id, user_number, draw_number
       FROM tickets
       WHERE pool_name = ?`,
      [title]
    );

    const ticketCount = Array.isArray(tickets) ? tickets.length : 0;
    const hasTickets = ticketCount > 0;

    logger.info(
      { ...ctx, resultId, ticketCount },
      "Tickets loaded for winner selection"
    );

    const candidates = hasTickets ? pickWinners(tickets) : [];
    const dummyCandidates = dummyUserIds.map((id) => ({ user_id: id, score: -1 }));
    const allCandidates = [...candidates, ...dummyCandidates];

    if (allCandidates.length < 3) {
      logger.error(
        { ...ctx, resultId, candidateCount: allCandidates.length },
        "Not enough candidates to declare winners"
      );
      throw new Error("Not enough candidates (need at least 3) to declare winners");
    }

    const candidateWinners = allCandidates.map((c) => ({
      user_id: c.user_id,
      role: realUserIds.includes(c.user_id) ? "user" : "dummy_user",
      score: c.score ?? 0,
    }));

    const finalWinners = sortWinners(candidateWinners, realUserIds.length, 100, {
      strict: false,
      preferHighScore: true,
    });

    logger.info(
      {
        ...ctx,
        resultId,
        winners: finalWinners.map((w) => ({
          position: w.position,
          userId: w.user_id,
          role: w.role,
          score: w.score,
        })),
      },
      "Winners selected"
    );

    for (const w of finalWinners) {
      const prizeAmount =
        totalPrize > 0 ? calculatePrizeAmount(totalPrize, w.position) : 0;

      await conn.execute(
        `INSERT INTO result_winners (result_id, user_id, position, prize_amount)
         VALUES (?, ?, ?, ?)`,
        [resultId, w.user_id, w.position, prizeAmount]
      );
    }

    const winnersDetailed = await winnerDetails(conn, finalWinners, title);

    await conn.commit();

    logger.info(
      {
        ...ctx,
        resultId,
        prizePool: totalPrize,
        ticketCount,
        realUsersUsed: realUserIds.length,
        dummyUsersUsed: dummyUserIds.length,
        durationMs: Date.now() - start,
      },
      "Declare result completed"
    );

    return {
      skipped: false,
      poolId,
      title,
      resultId,
      total_users: final100.length,
      real_users_used: realUserIds.length,
      dummy_users_used: dummyUserIds.length,
      prize_pool: totalPrize,
      winners: winnersDetailed,
    };
  } catch (err) {
    try {
      await conn.rollback();
      logger.warn({ ...ctx, err }, "Declare result rolled back");
    } catch (rbErr) {
      logger.error({ ...ctx, err: rbErr }, "Rollback failed");
    }

    logger.error(
      { ...ctx, err, durationMs: Date.now() - start },
      "Declare result crashed"
    );

    throw err;
  } finally {
    conn.release();
  }
};