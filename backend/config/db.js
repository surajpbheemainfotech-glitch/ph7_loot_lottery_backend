import mysql from "mysql2/promise";
import dotenv from "dotenv";

dotenv.config();

let db; 

export const connectDB = async () => {
  try {
    db = mysql.createPool({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0,
    });

    await db.getConnection(); // test
    console.log("✅ MySQL connected");

  } catch (error) {
    console.error("❌ MySQL connection failed:", error.message);
    process.exit(1);
  }
};

export { db }; 
