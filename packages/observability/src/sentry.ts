import * as Sentry from "@sentry/core";
import { CloudflareClient, getDefaultIntegrations } from "@sentry/cloudflare";

export interface SentryEnv {
  SENTRY_DSN?: string;
  SENTRY_ENVIRONMENT?: string;
  SENTRY_RELEASE?: string;
  SENTRY_TRACES_SAMPLE_RATE?: string;
}

export function initSentry(env: SentryEnv): void {
  if (!env.SENTRY_DSN) return;

  const clientOptions = {
    dsn: env.SENTRY_DSN,
    environment: env.SENTRY_ENVIRONMENT ?? "production",
    release: env.SENTRY_RELEASE ?? undefined,
    tracesSampleRate: env.SENTRY_TRACES_SAMPLE_RATE
      ? Number(env.SENTRY_TRACES_SAMPLE_RATE) : 0.1,
    sendDefaultPii: false,
    defaultIntegrations: getDefaultIntegrations({ dsn: env.SENTRY_DSN }),
  };

  Sentry.initAndBind(CloudflareClient, clientOptions as any);
}

export function captureException(err: unknown, context?: Record<string, unknown>): void {
  Sentry.captureException(err, { extra: context ?? {} });
}

export function setUserContext(user: { id: string; email?: string | null } | null): void {
  if (!user) Sentry.setUser(null);
  else Sentry.setUser({ id: user.id, email: user.email ?? undefined });
}

export function setTags(tags: Record<string, string>): void {
  Sentry.setTags(tags);
}

export function addBreadcrumb(category: string, message: string, data?: Record<string, unknown>): void {
  Sentry.addBreadcrumb({ category, message, data, level: "info" });
}

/** Wrap an async function so all thrown errors are sent to Sentry but rethrown. */
export async function withSentry<T>(fn: () => Promise<T>, tags?: Record<string, string>): Promise<T> {
  try {
    if (tags) Sentry.setTags(tags);
    return await fn();
  } catch (err) {
    Sentry.captureException(err);
    throw err;
  }
}
