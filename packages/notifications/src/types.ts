import { z } from "zod";

export const channelSchema = z.enum(["in_app", "email", "slack"]);
export type Channel = z.infer<typeof channelSchema>;

export const notificationCategorySchema = z.enum([
  "system", "billing", "article", "monitoring", "support", "security", "digest",
]);
export type NotificationCategory = z.infer<typeof notificationCategorySchema>;

/** Strongly-typed event payload registry. Add a new key + payload type when a new event is added. */
export interface NotificationEventPayloads {
  "article.published": { articleId: string; projectId: string; title: string; url: string };
  "article.generation_failed": { articleId: string; projectId: string; title: string; reason: string };
  "generation_run.completed": { runId: string; projectId: string; completed: number; failed: number };
  "monitoring.completed": { projectId: string; runId: string; cited: number; total: number };
  "learning.ready": { projectId: string; periodStart: string; summary: string };
  "citation.alert": { projectId: string; previousRate: number; currentRate: number; engine?: string };
  "billing.invoice_paid": { invoiceId: string; number: string; amountJpy: number };
  "billing.payment_failed": { invoiceId: string; number: string; amountJpy: number; hostedInvoiceUrl: string };
  "billing.trial_ending": { subscriptionId: string; trialEnd: string };
  "billing.usage_warning": { projectId: string; used: number; quota: number; remaining: number };
  "billing.usage_exceeded": { projectId: string; used: number; quota: number };
  "security.new_login": { ip: string; userAgent: string; at: string };
  "security.password_changed": { at: string };
  "support.message_received": { ticketId: string; messagePreview: string };
  "digest.weekly": { periodStart: string; periodEnd: string; counts: Record<string, number> };
  "admin.cost_spike": { date: string; costJpy: number; baselineJpy: number };
  "admin.webhook_failure": { source: string; consecutiveFailures: number; lastError: string };
}

export type NotificationTypeKey = keyof NotificationEventPayloads;

export interface DispatchRequest<K extends NotificationTypeKey = NotificationTypeKey> {
  type: K;
  recipientId: string;       // profile id; "admin-broadcast" for admin-only events
  data: NotificationEventPayloads[K];
  /** Override target channels (default: from notification_types + user prefs). */
  channels?: Channel[];
  /** Override action URL inside the notification. */
  actionUrl?: string;
  /** Override dedupe key. Defaults to `${type}:${data.{primaryId}}`. */
  dedupeKey?: string;
}
