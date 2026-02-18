import  transporter from "../../config/mailConfig.js"

const sendEmail = async ({ to, subject, text, html }) => {
  try {
    const info = await transporter.sendMail({
      from: `"Node Mailer" <${process.env.GMAIL_USER}>`,
      to,
      subject,
      text,
      html,
    });

    console.log("Email sent:", info.response);
    return info;
  } catch (error) {
    console.error("Email error:", error);
    throw error;
  }
};

export default sendEmail;
