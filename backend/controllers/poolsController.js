import { db } from "../config/db.js";
import { makeUniqueSlug, makeSlug } from "../helper/slugGenerator.js";
import fs from "fs";
import path from "path";
import { fetchDummyUsers } from "./userController.js";

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


export const declareResult = async (req, res) => {
  
  let conn;
  try {
    const { pool_name } = req.params;

    if (!pool_name) {
      return res.status(400).json({ success: false, message: "Pool name is required" });
    }

    conn = await db.getConnection();
    await conn.beginTransaction();

    // 1) Pool
    const [poolRows] = await conn.execute(
      `SELECT id, jackpot, expire_at, status
       FROM pools
       WHERE title = ?`,
      [pool_name]
    );

    if (poolRows.length === 0) {
      await conn.rollback();
      return res.status(404).json({ success: false, message: "Pool not found" });
    }

    const pool = poolRows[0];

    // 2) Create result (✅ declared_at = expire_at)
    const [resultInsert] = await conn.execute(
      `INSERT INTO results (pool_id, declared_at)
       VALUES (?, ?)`,
      [pool.id, pool.expire_at]
    );

    const resultId = resultInsert.insertId;

    // 3) Get all users from tickets for this pool
    //    ✅ pool table me user_id nahi chahiye
    const [ticketUsers] = await conn.execute(
      `SELECT DISTINCT user_id
       FROM tickets
       WHERE pool_name = ? AND payment_status = 'paid'`,
      [pool_name]
    );

    if (ticketUsers.length === 0) {
      await conn.rollback();
      return res.status(409).json({
        success: false,
        message: "No paid tickets found for this pool",
      });
    }

    // 4) Bulk insert into result_users
    const values = ticketUsers.map((r) => [resultId, r.user_id]);

   const [result] =  await conn.query(
      `INSERT INTO result_users (result_id, user_id)
       VALUES ?`,
      [values]
    );

    const [user] = await db.execute(
      `SELECT first_name, email FROM users WHERE id = ?`,
      [result.user_id]
    );

    if(user.length == 0){
      return res.status(404).json({success: true, message: "User not found"})
    }else{
      let total_users  =  user.length - 100
    }

    const dummy_user = await fetchDummyUsers(total_users) 

    await conn.commit();

    return res.status(200).json({
      success: true,
      message: "Result declared & result_users inserted successfully",
    });
  } catch (error) {
    if (conn) await conn.rollback();
    console.error("declareResult error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error while declaring result",
      error: error.message,
    });
  } finally {
    if (conn) conn.release();
  }
};



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
}

export const deleteExpirePool = async (req, res) => {

  try {
    const [result] = await db.execute(
      "DELETE FROM pools WHERE status = ?",
      ["expired"]
    );

    if (result.affectedRows === 0) {
      console.log("message: No expired pools found to delete")
    }

    console.log(`🗑️ Expired pools deleted: ${result.affectedRows}`);
    return result.affectedRows;

  } catch (error) {
    console.error(" Pool delete error:", error);
    return 0;
  }
}

