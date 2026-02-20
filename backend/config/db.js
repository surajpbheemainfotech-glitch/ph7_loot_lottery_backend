import mysql from "mysql2/promise";
import dotenv from "dotenv";
import { logger } from "./loggers.js";

dotenv.config();

let db;

export const connectDB = async () => {
  const start = Date.now();

  try {
    logger.info(
      {
        action: "db.init",
        host: process.env.DB_HOST,
        database: process.env.DB_NAME,
      },
      "Initializing MySQL pool"
    );

    db = mysql.createPool({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0,
    });

    // Test connection
    const connection = await db.getConnection();
    connection.release();

    logger.info(
      {
        action: "db.init_success",
        durationMs: Date.now() - start,
      },
      "MySQL connected successfully"
    );
  } catch (err) {
    logger.fatal(
      {
        action: "db.init_failed",
        err,
        durationMs: Date.now() - start,
      },
      "MySQL connection failed"
    );

    process.exit(1); 
  }
};

export { db };