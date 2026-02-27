import renderTemplate from "../renderTemplate/renderTemplate.js";

const buildForgotPasswordOtpEmail = ({
  name,
  otp,
  role = "user",
  expiryMinutes = 5,
}) => {
  const appName = process.env.APP_NAME || "My App";
  const year = new Date().getFullYear();

  const purpose = "Forgot Password";
  const roleKey = String(role || "user").toLowerCase();
  const roleLabel = roleKey === "admin" ? "Admin" : "User";

  const subject =
    roleKey === "admin"
      ? `Admin OTP for ${purpose}`
      : `Your OTP for ${purpose}`;

  const adminNote =
    roleKey === "admin"
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
    appName,
    year,
    name: name || "User",
    otp: String(otp ?? ""),
    roleLabel,
    purpose,
    expiryMinutes,
    adminNote, // otp.html must use {{{adminNote}}}
  });

  const text = `${appName} OTP

Hello ${name || "User"},
Your ${purpose} OTP for ${roleLabel} access is: ${String(otp ?? "")}
Expires in ${expiryMinutes} minutes.

${
  roleKey === "admin"
    ? "WARNING: Admin password reset requested. If this wasn't you, secure your account immediately."
    : ""
}

Do not share this OTP.`;

  return { subject, html, text };
};

export default buildForgotPasswordOtpEmail;