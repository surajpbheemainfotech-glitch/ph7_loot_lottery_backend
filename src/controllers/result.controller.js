import { db } from "../config/db.js";


export const getResultWinnersByPoolName = async (req, res) => {
  const start = Date.now();
  const { title } = req.params;

  try {
    req.log.info({ action: "pool.result_winners", title }, "Get result winners request");

    if (!title || !title.trim()) {
      req.log.warn(
        { action: "pool.result_winners", reason: "missing_title" },
        "Get result winners failed"
      );
      return res.status(400).json({ success: false, message: "pool_name is required" });
    }

    const [[result]] = await db.execute(
      `
      SELECT id, pool_title, jackpot, declared_at
      FROM results
      WHERE TRIM(LOWER(pool_title)) = TRIM(LOWER(?))
      ORDER BY declared_at DESC
      LIMIT 1
      `,
      [title]
    );

    if (!result) {
      req.log.warn(
        { action: "pool.result_winners", title, reason: "result_not_found" },
        "Get result winners failed"
      );
      return res.status(404).json({ success: false, message: "No result found for this pool" });
    }

    const [winners] = await db.execute(
      `
      SELECT rw.position, rw.prize_amount, u.id AS user_id, u.first_name, u.last_name, u.email
      FROM result_winners rw
      JOIN users u ON u.id = rw.user_id
      WHERE rw.result_id = ?
      ORDER BY rw.position ASC
      LIMIT 3
      `,
      [result.id]
    );

    if (!winners.length) {
      req.log.warn(
        { action: "pool.result_winners", resultId: result.id, reason: "winners_not_declared" },
        "Get result winners failed"
      );
      return res.status(404).json({ success: false, message: "Winners not declared yet" });
    }

    req.log.info(
      { action: "pool.result_winners", resultId: result.id, winnerCount: winners.length, durationMs: Date.now() - start },
      "Result winners fetched"
    );

    return res.status(200).json({
      success: true,
      message: "Result winners",
      data: {
        pool_name: result.pool_title,
        jackpot: result.jackpot,
        declared_at: result.declared_at,
        winners,
      },
    });
  } catch (err) {
    req.log.error(
      { action: "pool.result_winners", title, err, durationMs: Date.now() - start },
      "Get result winners crashed"
    );
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

export const getUserResultById = async (req, res) => {
  const start = Date.now();
  const { id } = req.params;

  try {
    req.log.info({ action: "pool.user_result", userId: id }, "Get user result request");

    if (!id) {
      req.log.warn(
        { action: "pool.user_result", reason: "missing_userId" },
        "Get user result failed"
      );
      return res.status(400).json({ success: false, message: "User id required" });
    }

    const [user] = await db.execute(
      `SELECT position, prize_amount FROM result_winners WHERE user_id = ?`,
      [id]
    );

    if (user.length > 0) {
      req.log.info(
        { action: "pool.user_result", userId: id, position: user[0].position, durationMs: Date.now() - start },
        "User result found"
      );

      return res.status(200).json({
        success: true,
        position: user[0].position,
        prize_amount: user[0].prize_amount,
      });
    }

    req.log.info(
      { action: "pool.user_result", userId: id, position: 0, durationMs: Date.now() - start },
      "User result not found"
    );

    return res.status(200).json({ success: true, position: 0, prize_amount: 0 });
  } catch (err) {
    req.log.error(
      { action: "pool.user_result", userId: id, err, durationMs: Date.now() - start },
      "Get user result crashed"
    );
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

export const getResults = async (req,res) =>{
   const start = Date.now();
    req.log.info({action: "pool.results"},  "All results request");
  try {
    
      const [results] = await db.execute(
        `SELECT 
          r.id AS result_id, r.pool_title, r.jackpot,
          u.first_name, u.last_name, u.email,
          rw.position, rw.prize_amount
        FROM results r
        LEFT JOIN result_winners rw 
         ON r.id = rw.result_id
        LEFT JOIN users u 
         ON rw.user_id = u.id
        ORDER BY r.id DESC, rw.position ASC`
      )

      if(results.length === 0){
        return res.json({
          success: false, 
          message: "Results are not declared yet ."
        })
      }

      req.log.info(
      {  durationMs: Date.now() - start },
      "Result checkout success"
    );

      return res.status(200).json({
        success: true,
        results: results
      })
  } catch (err) {
    req.log.error(
      { err, durationMs: Date.now() - start },
      "All result checkout failed"
    );
    return res.status(500).json({
      success: false, 
      message: "Internal server error ."
    })
  }
}