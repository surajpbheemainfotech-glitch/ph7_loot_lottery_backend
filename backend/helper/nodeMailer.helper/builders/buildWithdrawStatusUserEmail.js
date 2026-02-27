import renderTemplate from "../renderTemplate/renderTemplate.js";

const escapeHtml = (value) =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const buildWithdrawStatusUserEmail = ({
  name,
  withdrawId,
  amount,
  status,
  adminNote,
  updatedAt = new Date(),
}) => {
  const appName = process.env.APP_NAME || "My App";
  const year = new Date().getFullYear();

  const statusUpper = (status || "").toUpperCase();

  const subject =
    statusUpper === "APPROVED"
      ? `Withdrawal Approved (#${withdrawId})`
      : statusUpper === "REJECTED"
      ? `Withdrawal Rejected (#${withdrawId})`
      : `Withdrawal Update (#${withdrawId})`;

  const statusColor =
    statusUpper === "APPROVED" || statusUpper === "SUCCESS"
      ? "#16a34a"
      : statusUpper === "REJECTED" || statusUpper === "FAILED"
      ? "#dc2626"
      : "#f59e0b";

  const adminNoteBlock = adminNote
    ? `
      <div style="margin-top:14px;padding:12px;border-radius:6px;
                  background:#f9fafb;border:1px solid #e5e7eb;
                  font-size:13px;color:#374151;">
        <b>Admin Note:</b><br/>
        ${escapeHtml(adminNote).replace(/\n/g, "<br/>")}
      </div>
    `
    : "";

  const html = renderTemplate("withdraw-user-status.html", {
    appName,
    year,
    name: name || "User",
    withdrawId,
    amount,
    status: `<span style="color:${statusColor};font-weight:600;">${escapeHtml(
      statusUpper
    )}</span>`,
    updatedAt: new Date(updatedAt).toLocaleString("en-IN"),
    adminNote: adminNoteBlock, // template must use {{{adminNote}}}
  });

  const text = `${appName} - Withdrawal Update

Hello ${name || "User"},

Your withdrawal request #${withdrawId} for ₹${amount} has been ${statusUpper}.

${adminNote ? `Admin Note: ${adminNote}\n` : ""}

Updated at: ${new Date(updatedAt).toLocaleString("en-IN")}

If you have questions, contact support.

(Automated message)`;

  return { subject, html, text };
};

export default buildWithdrawStatusUserEmail;