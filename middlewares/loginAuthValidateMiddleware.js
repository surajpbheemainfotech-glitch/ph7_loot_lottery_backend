export const loginAuthValidateMiddleware = (req,res, next)=>{

    const {email, password} = req.body

      // 🔹 Email
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!email || !emailRegex.test(email)) {
    return res.status(400).json({
      success: false,
      message: "Valid email is required"
    });
  }

  
// 🔹 Strong Password
const strongPasswordRegex =
  /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;

if (!password || !strongPasswordRegex.test(password)) {
  return res.status(400).json({
    success: false,
    message:
      "Incorrect Password, try again"
  });
}

 // ✅ All validations passed
  next();
}