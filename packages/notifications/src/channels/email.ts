import { Resend } from "resend";
import { TransientNotificationError } from "../errors";

export interface EmailEnv {
  RESEND_API_KEY: string;
  EMAIL_FROM: string;          // "Coreberg <noreply@coreberg.example>"
  EMAIL_REPLY_TO?: string;
}

export interface SendEmailInput {
  to: string;
  toName?: string | null;
  subject: string;
  html: string;
  text: string;
  tags?: { name: string; value: string }[];
}

export async function sendEmail(env: EmailEnv, input: SendEmailInput): Promise<string> {
  if (!env.RESEND_API_KEY) throw new Error("RESEND_API_KEY missing");
  const resend = new Resend(env.RESEND_API_KEY);
  try {
    const result = await resend.emails.send({
      from: env.EMAIL_FROM,
      to: input.toName ? `${input.toName} <${input.to}>` : input.to,
      replyTo: env.EMAIL_REPLY_TO,
      subject: input.subject,
      html: input.html,
      text: input.text,
      tags: input.tags,
    });
    if (result.error) {
      // Resend marks 5xx and quota errors as retryable
      const msg = result.error.message ?? "unknown";
      if (/rate|timeout|5\d\d/i.test(msg)) throw new TransientNotificationError(msg);
      throw new Error(`Resend: ${msg}`);
    }
    return result.data?.id ?? "";
  } catch (err) {
    if (err instanceof TransientNotificationError) throw err;
    throw new Error(`Email send failed: ${(err as Error).message}`);
  }
}
