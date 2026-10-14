"use server";

import { after } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { sendEmail } from "@/lib/email/mailer";
import { contactReceiptEmail } from "@/lib/email/templates";
import { getSettings } from "@/lib/settings";

export type ContactState = { error?: string; success?: string; fieldErrors?: Record<string, string[] | undefined> } | null;

const schema = z.object({
  name: z.string().trim().min(2, "Enter your name.").max(100),
  email: z.email("Enter a valid email address.").trim().toLowerCase(),
  phone: z.string().trim().max(30).optional(),
  subject: z.string().trim().min(1).max(100),
  message: z.string().trim().min(10, "Please write at least a few words.").max(2000),
  website: z.string().max(0).optional(),
});

export async function sendContactMessage(_: ContactState, formData: FormData): Promise<ContactState> {
  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { fieldErrors: z.flattenError(parsed.error).fieldErrors };
  if (parsed.data.website) return { success: "Your message has been received." };
  const { name, email, phone, subject, message } = parsed.data;
  const data = { name, email, phone, subject, message };
  await db.contactMessage.create({ data: { ...data, phone: data.phone || null } });
  const hotel = await getSettings();
  after(() => sendEmail({ to: data.email, template: "contact-receipt", ...contactReceiptEmail(data.name.split(" ")[0]!, data.subject, hotel) }));
  return { success: "Your message has been received. We'll be in touch within one business day." };
}
