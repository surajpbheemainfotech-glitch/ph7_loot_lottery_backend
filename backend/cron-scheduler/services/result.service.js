import { db } from "../../config/db.js";

import { fetchDummyUsers } from "../../helper/pool.result.helper/fetchDummyUsers.js";
import { pickWinners } from "../../helper/pool.result.helper/pickWinners.js";
import { sortWinners } from "../../helper/pool.result.helper/sortWinners.js";
import { calculatePrizeAmount } from "../../helper/pool.result.helper/calculatePrizeAmount.js";
import { winnerDetails } from "../../helper/pool.result.helper/winnerDetails.js";

export const declareResultForPool = async ({ id: poolId, title, jackpot }) => {
  if (!poolId || !title) throw new Error("poolId and title are required");

  const conn = await db.getConnection();

  try {
    await conn.beginTransaction();

    // 🔒 Lock pool row (race-condition protection)
    const [poolLock] = await conn.execute(
      `SELECT id, title, jackpot
       FROM pools
       WHERE id = ?
       FOR UPDATE`,
      [poolId]
    );

    if (!poolLock.length) throw new Error("pool not found");

    const totalPrize = Number(poolLock[0].jackpot ?? jackpot ?? 0);

    // ✅ Idempotency: skip if already declared
    const [existingResult] = await conn.execute(
      `SELECT id FROM results WHERE pool_id = ? LIMIT 1`,
      [poolId]
    );

    if (existingResult.length) {
      // no writes happened yet, rollback is fine
      await conn.rollback();
      return { skipped: true, reason: "already_declared", poolId, title };
    }

    // 1) Insert result
    const [resultInsert] = await conn.execute(
      `INSERT INTO results (
     pool_id,
     pool_title,
     jackpot,
     declared_at,
     created_at
   )
   VALUES (?, ?, ?, NOW(), NOW())`,
      [poolId, title, totalPrize]
    );
    const resultId = resultInsert.insertId;

    // 2) Real users (distinct)
    const [realRows] = await conn.execute(
      `SELECT DISTINCT user_id
       FROM tickets
       WHERE pool_name = ?`,
      [title]
    );

    let realUserIds = realRows.map(r => r.user_id);
    if (realUserIds.length > 100) realUserIds = realUserIds.slice(0, 100);

    // 3) Dummy fill up to 100
    const remaining = 100 - realUserIds.length;
    let dummyUserIds = [];

    if (remaining > 0) {
      const dummyUsers = await fetchDummyUsers(conn, remaining * 2);
      dummyUserIds = dummyUsers
        .map(u => u.id)
        .filter(id => !realUserIds.includes(id))
        .slice(0, remaining);
    }

    const final100 = [...realUserIds, ...dummyUserIds].slice(0, 100);

    // 4) Insert result_users snapshot
    if (final100.length) {
      const values = final100.map(uid => [resultId, uid, new Date()]);
      await conn.query(
        `INSERT INTO result_users (result_id, user_id, created_at) VALUES ?`,
        [values]
      );
    }

    // 5) Pull tickets (can be empty)
    const [tickets] = await conn.execute(
      `SELECT id AS ticket_id, user_id, user_number, draw_number
   FROM tickets
   WHERE pool_name = ?`,
      [title]
    );

    const hasTickets = Array.isArray(tickets) && tickets.length > 0;

    // 6) Candidates
    const candidates = hasTickets ? pickWinners(tickets) : []; // ✅ safe now
    const dummyCandidates = dummyUserIds.map(id => ({ user_id: id, score: -1 }));
    const allCandidates = [...candidates, ...dummyCandidates];

    // ✅ Ensure we can pick top 3 (dummy fill should guarantee this)
    if (allCandidates.length < 3) {
      throw new Error("Not enough candidates (need at least 3) to declare winners");
    }

    // 7) Add roles
    const candidateWinners = allCandidates.map(c => ({
      user_id: c.user_id,
      role: realUserIds.includes(c.user_id) ? "user" : "dummy_user",
      score: c.score ?? 0,
    }));

    // 8) Final winners top-3
    // ✅ strict:false prevents errors when no real users exist
    const finalWinners = sortWinners(candidateWinners, realUserIds.length, 100, {
      strict: false,
      preferHighScore: true,
    });


    // 9) Save winners
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
    } catch (_) { }
    throw err;
  } finally {
    conn.release();
  }
};
