import renderTemplate from "./renderTemplate/renderTemplate.js"; 

const buildForgotPasswordOtpEmail = ({
  name,
  otp,
  role = "user",
  expiryMinutes = 5,
}) => {
  const purpose = "Forgot Password";
  const roleLabel = role === "admin" ? "Admin" : "User";

  const subject =
    role === "admin"
      ? `Admin OTP for ${purpose}`
      : `Your OTP for ${purpose}`;

  const adminNote =
    role === "admin"
      ? `
      <div style="margin-top:12px;padding:10px;border:1px solid #fca5a5;
                  background:#fef2f2;border-radius:6px;
                  font-size:12px;color:#b91c1c;">
        ⚠️ Admin password reset requested.
        If this wasn’t you, secure your account immediately.
      </div>
      `
      : "";

  const html = renderTemplate("otp.html", {
    appName: process.env.APP_NAME || "My App",
    year: new Date().getFullYear(),
    name: name || "User",
    otp,
    roleLabel,
    purpose,
    expiryMinutes,
    adminNote, // ✅ injected into {{adminNote}}
  });

  const text = `${process.env.APP_NAME || "My App"} OTP

Hello ${name || "User"},
Your ${purpose} OTP for ${roleLabel} access is: ${otp}
Expires in ${expiryMinutes} minutes.

${
  role === "admin"
    ? "WARNING: Admin password reset requested. If this wasn't you, secure your account immediately."
    : ""
}

Do not share this OTP.`;

  return { subject, html, text };
};

export default buildForgotPasswordOtpEmail;
