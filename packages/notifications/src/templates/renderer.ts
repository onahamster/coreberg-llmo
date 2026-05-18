import type { RenderInput, RenderedTemplate } from "./types";
import { layoutEmail } from "./layout";
import { articlePublishedTemplate } from "./article-published";
import { articleFailedTemplate } from "./article-failed";
import { learningReadyTemplate } from "./learning-ready";
import { citationAlertTemplate } from "./citation-alert";
import { billingPaymentFailedTemplate } from "./billing-payment-failed";
import { billingUsageWarningTemplate } from "./billing-usage-warning";
import { billingUsageExceededTemplate } from "./billing-usage-exceeded";
import { billingTrialEndingTemplate } from "./billing-trial-ending";
import { securityNewLoginTemplate } from "./security-new-login";
import { supportMessageTemplate } from "./support-message";
import { weeklyDigestTemplate } from "./weekly-digest";
import { genericTemplate } from "./generic";

export interface TemplateModule {
  build(input: RenderInput): { title: string; bodyMarkdown: string; actionLabel?: string };
}

const REGISTRY: Record<string, TemplateModule> = {
  "article.published":          articlePublishedTemplate,
  "article.generation_failed":  articleFailedTemplate,
  "learning.ready":             learningReadyTemplate,
  "citation.alert":             citationAlertTemplate,
  "billing.payment_failed":     billingPaymentFailedTemplate,
  "billing.usage_warning":      billingUsageWarningTemplate,
  "billing.usage_exceeded":     billingUsageExceededTemplate,
  "billing.trial_ending":       billingTrialEndingTemplate,
  "security.new_login":         securityNewLoginTemplate,
  "support.message_received":   supportMessageTemplate,
  "digest.weekly":              weeklyDigestTemplate,
};

export function renderTemplate(input: RenderInput): RenderedTemplate {
  const mod = REGISTRY[input.typeKey] ?? genericTemplate;
  const built = mod.build(input);
  const subject = input.typeDef.email_subject_template
    ? mustache(input.typeDef.email_subject_template, input.data)
    : built.title;
  const actionUrl = input.actionUrl ?? defaultActionUrl(input);
  const html = layoutEmail({
    recipientName: input.recipient.name,
    title: built.title,
    bodyMarkdown: built.bodyMarkdown,
    actionUrl,
    actionLabel: built.actionLabel ?? "詳細を開く",
    baseUrl: input.baseUrl,
  });
  const bodyText = markdownToText(built.bodyMarkdown);
  return { title: built.title, subject, html, bodyText, actionUrl: actionUrl ?? null };
}

export function mustache(template: string, data: Record<string, unknown>): string {
  return template.replace(/\{\{([\w.]+)\}\}/g, (_, k) => {
    const v = k.split(".").reduce<unknown>((a, p) => (a as Record<string, unknown>)?.[p], data);
    return v == null ? "" : String(v);
  });
}

function defaultActionUrl(input: RenderInput): string | undefined {
  const d = input.data as Record<string, unknown>;
  if (d.articleId && d.projectId)
    return `${input.baseUrl}/projects/${d.projectId}/articles/${d.articleId}`;
  if (d.projectId) return `${input.baseUrl}/projects/${d.projectId}`;
  if (d.invoiceId) return `${input.baseUrl}/settings/billing`;
  if (d.ticketId) return `${input.baseUrl}/support/${d.ticketId}`;
  return `${input.baseUrl}/dashboard`;
}

function markdownToText(md: string): string {
  return md
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/^#+\s+/gm, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
