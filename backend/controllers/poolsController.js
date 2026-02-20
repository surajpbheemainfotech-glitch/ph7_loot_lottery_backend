import { db } from "../config/db.js";
import { makeUniqueSlug, makeSlug } from "../helper/pool.helper/slugGenerator.js";
import fs from "fs";
import path from "path";


export const createPool = async (req, res) => {
  const start = Date.now();
  try {
    const image = req.file;
    const { title, price, jackpot, start_at, expire_at } = req.body;

    req.log.info(
      {
        action: "pool.create",
        title,
        price,
        jackpot,
        start_at,
        expire_at,
        file: image ? { filename: image.filename, size: image.size } : null,
      },
      "Create pool request"
    );

    if (!title || price == null || !start_at || !expire_at) {
      req.log.warn(
        { action: "pool.create", reason: "missing_fields" },
        "Create pool failed"
      );
      return res.status(400).json({
        success: false,
        message: "title, price, start_at, expireAt required",
      });
    }

    if (!image) {
      req.log.warn(
        { action: "pool.create", reason: "missing_image" },
        "Create pool failed"
      );
      return res.status(400).json({
        success: false,
        message: "Ticket image is required",
      });
    }

    const startAtIST = new Date(`${start_at}:00+05:30`);
    const expireAtIST = new Date(`${expire_at}:00+05:30`);

    if (Number.isNaN(startAtIST.getTime()) || Number.isNaN(expireAtIST.getTime())) {
      req.log.warn(
        { action: "pool.create", reason: "invalid_dates", start_at, expire_at },
        "Create pool failed"
      );
      return res.status(400).json({ success: false, message: "Invalid startAt or expireAt" });
    }

    if (startAtIST.getTime() >= expireAtIST.getTime()) {
      req.log.warn(
        { action: "pool.create", reason: "expire_before_start", start_at, expire_at },
        "Create pool failed"
      );
      return res.status(400).json({
        success: false,
        message: "expireAt must be greater than startAt",
      });
    }

    const slug = await makeUniqueSlug(title);
    const imageUrl = `/uploads/${image.filename}`;

    const [result] = await db.execute(
      `INSERT INTO pools (title, slug, price, jackpot, Imageurl, start_at, expire_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [title, slug, price, jackpot || 0, imageUrl, startAtIST, expireAtIST]
    );

    const poolId = result?.insertId;

    req.log.info(
      { action: "pool.create", poolId, slug, durationMs: Date.now() - start },
      "Pool created"
    );

    return res.status(201).json({
      success: true,
      message: "Pool created successfully",
      slug,
    });
  } catch (err) {
    req.log.error(
      { action: "pool.create", err, durationMs: Date.now() - start },
      "Create pool crashed"
    );
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

export const getPool = async (req, res) => {
  const start = Date.now();
  try {
    req.log.info({ action: "pool.list" }, "Get pools request");

    const [rows] = await db.execute(`
      SELECT
        id,
        title,
        price,
        jackpot,
        Imageurl,
        start_at,
        expire_at,
        slug,
        CASE
          WHEN NOW() < start_at THEN 'upcoming'
          WHEN NOW() >= start_at AND NOW() < expire_at THEN 'active'
          ELSE 'expired'
        END AS status,
        UNIX_TIMESTAMP(start_at) * 1000  AS startAtMs,
        UNIX_TIMESTAMP(expire_at) * 1000 AS expireAtMs,
        UNIX_TIMESTAMP(NOW()) * 1000     AS serverNowMs
      FROM pools
      ORDER BY start_at DESC
    `);

    req.log.info(
      { action: "pool.list", count: rows.length, durationMs: Date.now() - start },
      "Pools fetched"
    );

    return res.status(200).json({ success: true, count: rows.length, data: rows });
  } catch (err) {
    req.log.error(
      { action: "pool.list", err, durationMs: Date.now() - start },
      "Fetch pools crashed"
    );
    return res.status(500).json({ success: false, message: "Failed to fetch pools" });
  }
};

export const updatePoolBySlug = async (req, res) => {
  const start = Date.now();
  const { slug } = req.params;

  try {
    const { title, price, jackpot, start_at, expire_at } = req.body;

    req.log.info(
      { action: "pool.update", slug, title, price, jackpot, start_at, expire_at },
      "Update pool request"
    );

    const [found] = await db.execute(`SELECT * FROM pools WHERE slug = ?`, [slug]);

    if (!found.length) {
      req.log.warn(
        { action: "pool.update", slug, reason: "not_found" },
        "Update pool failed"
      );
      return res.status(404).json({ success: false, message: "Ticket not found" });
    }

    const existing = found[0];

    const newTitle = title ?? existing.title;
    const newSlug = title ? makeSlug(title) : existing.slug;

    let newStartAt = existing.start_at;
    let newExpireAt = existing.expire_at;

    if (start_at) newStartAt = new Date(`${start_at}:00+05:30`);
    if (expire_at) newExpireAt = new Date(`${expire_at}:00+05:30`);

    if (new Date(newStartAt) >= new Date(newExpireAt)) {
      req.log.warn(
        { action: "pool.update", slug, reason: "expire_before_start" },
        "Update pool failed"
      );
      return res.status(400).json({
        success: false,
        message: "expireAt must be greater than startAt",
      });
    }

    await db.execute(
      `UPDATE pools
       SET title = ?, slug = ?, price = ?, jackpot = ?, start_at = ?, expire_at = ?
       WHERE slug = ?`,
      [
        newTitle,
        newSlug,
        price ?? existing.price,
        jackpot ?? existing.jackpot,
        newStartAt,
        newExpireAt,
        slug,
      ]
    );

    req.log.info(
      { action: "pool.update", oldSlug: slug, newSlug, durationMs: Date.now() - start },
      "Pool updated"
    );

    return res.json({ success: true, message: "Pool updated" });
  } catch (err) {
    req.log.error(
      { action: "pool.update", slug, err, durationMs: Date.now() - start },
      "Update pool crashed"
    );
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

export const deletePoolById = async (req, res) => {
  const start = Date.now();
  const { id } = req.params;

  try {
    req.log.info({ action: "pool.delete", poolId: id }, "Delete pool request");

    const [found] = await db.execute(`SELECT * FROM pools WHERE id = ?`, [id]);

    if (!found.length) {
      req.log.warn(
        { action: "pool.delete", poolId: id, reason: "not_found" },
        "Delete pool failed"
      );
      return res.status(404).json({ success: false, message: "Ticket not found" });
    }

    const ticket = found[0];

    await db.execute(`DELETE FROM pools WHERE id = ?`, [id]);

    // delete image file (best-effort)
    if (ticket.Imageurl) {
      const filePath = path.join(process.cwd(), ticket.Imageurl);
      fs.unlink(filePath, (err) => {
        if (err) {
          // not fatal; warn
          req.log.warn(
            { action: "pool.delete", poolId: id, filePath, err },
            "Image delete warning"
          );
        }
      });
    }

    req.log.info(
      { action: "pool.delete", poolId: id, durationMs: Date.now() - start },
      "Pool deleted"
    );

    return res.json({ success: true, message: "Pool deleted successfully" });
  } catch (err) {
    req.log.error(
      { action: "pool.delete", poolId: id, err, durationMs: Date.now() - start },
      "Delete pool crashed"
    );
    return res.status(500).json({ success: false, message: "Server error" });
  }
};


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
        jackpot: result.pool_jackpot, // ⚠️ note: your SELECT uses `jackpot` not `pool_jackpot`
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