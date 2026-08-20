import nodemailer from "nodemailer";
import { env } from "@ums/config";

export const mailer = nodemailer.createTransport({
  host: env.SMTP_HOST,
  port: env.SMTP_PORT,
  secure: env.SMTP_PORT === 465,
  auth: env.SMTP_USER
    ? {
        user: env.SMTP_USER,
        pass: env.SMTP_PASS,
      }
    : undefined,
});

export async function sendEmailNotification(to: string, subject: string, htmlContent: string) {
  try {
    await mailer.sendMail({
      from: `"Utama Memo System" <${env.SMTP_FROM}>`,
      to,
      subject,
      html: htmlContent,
    });
    console.log(`[MAILER] Sent email to ${to}: ${subject}`);
  } catch (error) {
    console.error(`[MAILER_ERROR] Failed to send email to ${to}:`, error);
    throw error;
  }
}
