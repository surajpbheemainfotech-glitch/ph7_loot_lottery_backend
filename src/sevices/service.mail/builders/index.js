import { buildWithdrawRequestAdminEmail } from "./buildWithdrawRequestAdminEmail.js";
import { buildWithdrawStatusUserEmail } from "./buildWithdrawStatusUserEmail.js";
import { buildForgotPasswordOtpEmail } from "./otpEmailBuilder.js";


export const MAIL_BUILDERS = {
  FORGOT_OTP: buildForgotPasswordOtpEmail,
  WITHDRAW_REQUEST_ADMIN: buildWithdrawRequestAdminEmail,
  WITHDRAW_STATUS_USER: buildWithdrawStatusUserEmail,
};