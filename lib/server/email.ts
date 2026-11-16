import "server-only";
import nodemailer from "nodemailer";

/** Gmail SMTP transport using an app password (GMAIL_USER + GMAIL_APP_PASSWORD).
 *  Personal, single-sender setup — no domain or provider account needed. */
export function emailConfigured(): boolean {
  return !!(process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD);
}

/** An inline image attached by Content-ID (referenced in the HTML as src="cid:…").
 *  The only image form Gmail AND Outlook reliably render in received mail. */
export interface EmailAttachment { filename: string; content: Buffer; cid: string; contentType?: string }

export async function sendDigestEmail(opts: {
  to: string; subject: string; html: string; text: string; attachments?: EmailAttachment[];
}): Promise<void> {
  const user = process.env.GMAIL_USER;
  const pass = process.env.GMAIL_APP_PASSWORD;
  if (!user || !pass) throw new Error("GMAIL_USER / GMAIL_APP_PASSWORD not configured");

  const transport = nodemailer.createTransport({
    service: "gmail",
    auth: { user, pass },
  });

  await transport.sendMail({
    from: `"The Morning Glide" <${user}>`,
    to: opts.to,
    subject: opts.subject,
    html: opts.html,
    text: opts.text,
    attachments: opts.attachments?.map((a) => ({ filename: a.filename, content: a.content, cid: a.cid, contentType: a.contentType ?? "image/png" })),
  });
}
