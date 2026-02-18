import { db } from "../../config/db"

export const deleteExpiredOtps = async(req,res)=>{
    try {
    const [result] = await db.query(
      "DELETE FROM otp_tokens WHERE expire_at < NOW()"
    );

    res.status(200).json({
      success: true,
      message: "Expired OTPs deleted successfully",
      affectedRows: result.affectedRows
    });

  } catch (error) {
    console.error("Error deleting expired OTPs:", error);
    res.status(500).json({
      success: false,
      message: "Server Error"
    });
  }
}