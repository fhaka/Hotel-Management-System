import "server-only";
import nodemailer, { type Transporter } from "nodemailer";
import { db } from "@/lib/db";

let transport: Transporter | null = null;

function getTransport() {
  transport ??= nodemailer.createTransport({
    host: process.env.SMTP_HOST ?? "localhost",
    port: Number(process.env.SMTP_PORT ?? 1025),
    secure: Number(process.env.SMTP_PORT) === 465,
    connectionTimeout: 5000,
    auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined,
  });
  return transport;
}

export type OutgoingEmail = {
  to: string;
  subject: string;
  html: string;
  template: string;
  reservationId?: string;
  attachments?: { filename: string; content: Buffer; contentType?: string }[];
};

/** Sends an email and records it in the email log. Never throws: a failed send is logged instead. */
export async function sendEmail(email: OutgoingEmail): Promise<boolean> {
  let error: string | null = null;
  try {
    await getTransport().sendMail({
      from: process.env.MAIL_FROM ?? "Hotel Imperial <reservations@hotelimperial.al>",
      to: email.to,
      subject: email.subject,
      html: email.html,
      attachments: email.attachments,
    });
  } catch (e) {
    error = e instanceof Error ? e.message : String(e);
    console.error(`[email] Failed to send "${email.subject}" to ${email.to}: ${error}`);
  }
  await db.emailLog.create({
    data: {
      to: email.to,
      subject: email.subject,
      template: email.template,
      status: error ? "FAILED" : "SENT",
      error,
      reservationId: email.reservationId ?? null,
    },
  });
  return !error;
}
