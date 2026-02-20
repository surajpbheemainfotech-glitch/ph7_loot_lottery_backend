import transporter from "../../config/mailConfig.js";
import { logger } from "../../config/loggers.js";

const maskEmail = (email = "") => {
  const [name, domain] = String(email).split("@");
  if (!name || !domain) return email;
  return `${name.slice(0, 2)}***@${domain}`;
};

const sendEmail = async ({ to, subject, text, html }) => {
  const start = Date.now();
  const safeTo = maskEmail(to);

  logger.info(
    { action: "email.send", to: safeTo, subject },
    "Sending email"
  );

  try {
    const info = await transporter.sendMail({
      from: `"Node Mailer" <${process.env.GMAIL_USER}>`,
      to,
      subject,
      text,
      html,
    });

    logger.info(
      {
        action: "email.send",
        to: safeTo,
        messageId: info.messageId,
        durationMs: Date.now() - start,
      },
      "Email sent successfully"
    );

    return info;
  } catch (err) {
    logger.error(
      {
        action: "email.send",
        to: safeTo,
        subject,
        err,
        durationMs: Date.now() - start,
      },
      "Email sending failed"
    );

    throw err;
  }
};

export default sendEmail;