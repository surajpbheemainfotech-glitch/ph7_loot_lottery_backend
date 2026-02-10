import { db } from "../config/db.js";
import { makeUniqueSlug, makeSlug } from "../helper/slugGenerator.js";
import fs from "fs";
import path from "path";


export const createPool = async (req, res) => {
  try {
    const image = req.file;
    const { title, price, jackpot, start_at, expire_at } = req.body;

    // ✅ validations
    if (!title || price == null || !start_at || !expire_at) {
      return res.status(400).json({
        success: false,
        message: "title, price, start_at, expireAt required",
      });
    }

    if (!image) {
      return res.status(400).json({
        success: false,
        message: "Ticket image is required",
      });
    }

    // ✅ parse IST times (datetime-local -> IST)
    const startAtIST = new Date(`${start_at}:00+05:30`);
    const expireAtIST = new Date(`${expire_at}:00+05:30`);

    if (
      Number.isNaN(startAtIST.getTime()) ||
      Number.isNaN(expireAtIST.getTime())
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid startAt or expireAt",
      });
    }

    if (startAtIST.getTime() >= expireAtIST.getTime()) {
      return res.status(400).json({
        success: false,
        message: "expireAt must be greater than startAt",
      });
    }

    // ✅ generate UNIQUE slug
    const slug = await makeUniqueSlug(title);

    // ✅ store relative image url
    const imageUrl = `/uploads/${image.filename}`;

    await db.execute(
      `INSERT INTO pools  
       (title, slug, price, jackpot, Imageurl, start_at, expire_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [title, slug, price, jackpot || 0, imageUrl, startAtIST, expireAtIST]
    );

    return res.status(201).json({
      success: true,
      message: "Pool created successfully",
      slug,
    });
  } catch (error) {
    console.error("Create Pool error:", error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};


export const getPool = async (req, res) => {

  try {
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

        -- auto status
        CASE
          WHEN NOW() < start_at THEN 'upcoming'
          WHEN NOW() >= start_at AND NOW() < expire_at THEN 'active'
          ELSE 'expired'
        END AS status,

        -- timer ready fields
        UNIX_TIMESTAMP(start_at) * 1000  AS startAtMs,
        UNIX_TIMESTAMP(expire_at) * 1000 AS expireAtMs,
        UNIX_TIMESTAMP(NOW()) * 1000     AS serverNowMs

      FROM pools
      ORDER BY start_at DESC
    `);

    return res.status(200).json({
      success: true,
      count: rows.length,
      data: rows,
    });

  } catch (error) {
    console.error("Fetch pools error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch pools",
    });
  }
}

export const updatePoolBySlug = async (req, res) => {
  try {
    const { slug } = req.params;


    const [found] = await db.execute(
      `SELECT * FROM pools WHERE slug = ?`,
      [slug]
    );

    if (!found.length) {
      return res.status(404).json({
        success: false,
        message: "Ticket not found",
      });
    }

    const existing = found[0];

    const { title, price, jackpot, start_at, expire_at } = req.body;

    const newTitle = title ?? existing.title;
    const newSlug =
      title ? makeSlug(title) : existing.slug;

    // 4️⃣ date handling 
    let newStartAt = existing.start_at;
    let newExpireAt = existing.expire_at;

    if (start_at) {
      newStartAt = new Date(`${start_at}:00+05:30`);
    }
    if (expire_at) {
      newExpireAt = new Date(`${expire_at}:00+05:30`);
    }

    if (new Date(newStartAt) >= new Date(newExpireAt)) {
      return res.status(400).json({
        success: false,
        message: "expireAt must be greater than startAt",
      });
    }

    await db.execute(
      `UPDATE pools
       SET title = ?, slug = ?, price = ?, jackpot = ?, start_at = ?, expire_at = ?
       WHERE slug = ?`,
      [newTitle, newSlug, price ?? existing.price, jackpot ?? existing.jackpot, newStartAt, newExpireAt, slug]
    );

    res.json({
      success: true,
      message: "Pool updated ",
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

export const deletePoolById = async (req, res) => {
  try {
    const { id } = req.params;


    const [found] = await db.execute(`SELECT * FROM pools WHERE id = ?`, [id]);

    if (!found.length) {
      return res.status(404).json({ success: false, message: "Ticket not found" });
    }

    const ticket = found[0];


    await db.execute(`DELETE FROM pools WHERE id = ?`, [id]);


    if (ticket.Imageurl) {
      const filePath = path.join(process.cwd(), ticket.Imageurl); // resolves "/uploads/abc.jpg"
      fs.unlink(filePath, (err) => {
        if (err) console.log("Image delete warning:", err.message);
      });
    }

    return res.json({ success: true, message: "Pool deleted successfully" });
  } catch (error) {
    console.error("Delete Pool error:", error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

export const getResultWinnersByPoolName = async (req, res) => {
  try {
    const { title } = req.params;

    if (!title || !title.trim()) {
      return res.status(400).json({
        success: false,
        message: "pool_name is required",
      });
    }

    // 1️⃣ Latest result by pool_name (snapshot safe)
    const [[result]] = await db.execute(
      `
      SELECT
        id,
        pool_title,
        jackpot,
        declared_at
      FROM results
      WHERE TRIM(LOWER(pool_title)) = TRIM(LOWER(?))
      ORDER BY declared_at DESC
      LIMIT 1
      `,
      [title]
    );

    if (!result) {
      return res.status(404).json({
        success: false,
        message: "No result found for this pool",
      });
    }

    // 2️⃣ Top-3 winners for that result
    const [winners] = await db.execute(
      `
      SELECT
        rw.position,
        rw.prize_amount,
        u.id AS user_id,
        u.first_name,
        u.last_name,
        u.email
      FROM result_winners rw
      JOIN users u ON u.id = rw.user_id
      WHERE rw.result_id = ?
      ORDER BY rw.position ASC
      LIMIT 3
      `,
      [result.id]
    );

    if (!winners.length) {
      return res.status(404).json({
        success: false,
        message: "Winners not declared yet",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Result winners",
      data: {
        pool_name: result.pool_title,
        jackpot: result.pool_jackpot,
        declared_at: result.declared_at,
        winners,
      },
    });

  } catch (error) {
    console.error("getResultWinnersByPoolName error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

export const getUserResultById = async (req, res) => {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({
        success: false,
        message: "User id required",
      });
    }

    const [user] = await db.execute(
      `SELECT position, prize_amount FROM result_winners WHERE user_id = ?`,
      [id]
    );

    // Agar user mil gaya
    if (user.length > 0) {
      return res.status(200).json({
        success: true,
        position: user[0].position,
        prize_amount: user[0].prize_amount,
      });
    }

    // Agar user nahi mila → random position
    const randomPosition = Math.floor(Math.random() * 100) + 1;

    return res.status(200).json({
      success: true,
      position: randomPosition,
      prize_amount: 0,
    });

  } catch (error) {
    console.error(error);
    return res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};


export const getExpirePoolByTitle = async (req, res) => {
  try {
    const { title } = req.query;

    // 400 - Bad Request
    if (!title) {
      return res.status(400).json({
        success: false,
        message: "title is required"
      });
    }

    const result = await db.query(
      `SELECT id AS pool_id, expire_at FROM pools WHERE title = $1`,
      [title]
    );

    // 404 - Not Found
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Pool not found"
      });
    }

    // 200 - OK
    return res.status(200).json({
      success: true,
      data: result.rows
    });

  } catch (error) {
    console.error(error);

    // 500 - Internal Server Error
    return res.status(500).json({
      success: false,
      message: "Internal server error"
    });
  }
};





