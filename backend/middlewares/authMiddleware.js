import jwt from "jsonwebtoken";

export const authenticate = (req, res, next) => {
  try {
    let token = req.cookies?.token;

    // header se token
    if (!token && req.headers.authorization) {
      const authHeader = req.headers.authorization;
      if (authHeader.startsWith("Bearer ")) {
        token = authHeader.split(" ")[1];
      }
    }

    // token missing
    if (!token) {
      return res.status(401).json({
        success: false,
        message: "Token missing",
      });
    }

    let decoded;

    // pehle admin secret try karo
    try {
      decoded = jwt.verify(token, process.env.ADMIN_JWT_SECRET);
      decoded.role = "admin";
    } catch (err) {
      // agar admin fail ho to user secret try karo
      decoded = jwt.verify(token, process.env.USER_JWT_SECRET);
      decoded.role = "user";
    }

    // user attach
    req.user = decoded;

    next(); // ✅ allow
  } catch (error) {
    console.log(error);
    return res.status(401).json({
      success: false,
      message: "Invalid or expired token",
    });
  }
};
