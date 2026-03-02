import renderTemplate from "../renderTemplate/renderTemplate.js";

const buildWithdrawRequestAdminEmail = ({
  withdrawId,
  userName,
  userEmail,
  amount,
  method,
  upiId,
  bankAccount,
  ifsc,
  accountHolder,
  status = "PENDING",
  requestDate = new Date(),
  dashboardUrl,
}) => {
  const methodKey = String(method || "").toLowerCase();   // "upi" | "bank"
  const methodLabel = methodKey ? methodKey.toUpperCase() : "";

  const subject = `New Withdrawal Request #${withdrawId}`;

  const html = renderTemplate("withdraw_request_admin.html", {
    appName: process.env.APP_NAME || "My App",
    year: new Date().getFullYear(),

    withdrawId,
    userName: userName || "",
    userEmail: userEmail || "",
    amount,
    method: methodLabel,

    // IMPORTANT: these are what your template expects
    isUpi: methodKey === "upi",
    isBank: methodKey === "bank",

    upiId: upiId || "",
    bankAccount: bankAccount || "",
    ifsc: ifsc || "",
    accountHolder: accountHolder || "",

    status,
    requestDate: new Date(requestDate).toLocaleString("en-IN"),
    dashboardUrl: dashboardUrl || process.env.ADMIN_DASHBOARD_URL || "",
  });

  const text =
`New Withdrawal Request

Withdraw ID: ${withdrawId}
User: ${userName || "-"}${userEmail ? ` (${userEmail})` : ""}
Amount: ₹${amount}
Method: ${methodLabel || "-"}

${methodKey === "upi" ? `UPI ID: ${upiId || "-"}` : ""}
${methodKey === "bank" ? `Bank Account: ${bankAccount || "-"}\nIFSC: ${ifsc || "-"}\nAccount Holder: ${accountHolder || "-"}` : ""}

Status: ${status}
Requested At: ${new Date(requestDate).toLocaleString("en-IN")}

Review: ${dashboardUrl || process.env.ADMIN_DASHBOARD_URL || "-"}

(Automated message — don’t reply.)`;

  return { subject, html, text };
};

export default buildWithdrawRequestAdminEmail;