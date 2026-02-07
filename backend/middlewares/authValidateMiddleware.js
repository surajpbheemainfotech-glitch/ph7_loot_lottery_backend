export const authValidateMiddleware = (req, res, next) => {
  const { title, first_name, last_name, email, password } = req.body;

  // 🔹 Title validation
  const allowedTitles = ["Mr", "Mrs", "Ms", "Dr"];
  if (!title || !allowedTitles.includes(title)) {
    return res.status(400).json({
      success: false,
      message: "Valid title is required (Mr, Mrs, Ms, Dr)"
    });
  }

  // 🔹 First name
  if (!first_name || first_name.trim().length < 3 ) {
    return res.status(400).json({
      success: false,
      message: "First name must be at least 3 characters"
    });
  }

  // 🔹 Last name
  if (!last_name || last_name.trim().length < 3) {
    return res.status(400).json({
      success: false,
      message: "Last name must be at least 3 characters"
    });
  }

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
      "Password must be at least 8 characters long and include uppercase, lowercase, number, and special character"
  });
}


  // ✅ All validations passed
  next();
};
