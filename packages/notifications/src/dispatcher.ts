import type { SupabaseClient } from "@supabase/supabase-js";
import type { Channel, DispatchRequest, NotificationTypeKey } from "./types";
import { renderTemplate } from "./templates";
import { sendEmail, type EmailEnv } from "./channels/email";
import { sendSlack, type SlackEnv } from "./channels/slack";
import { TransientNotificationError } from "./errors";

export interface DispatcherEnv extends EmailEnv, SlackEnv {
  APP_BASE_URL: string;
}

export async function dispatchNotification<K extends NotificationTypeKey>(
  sb: SupabaseClient,
  env: DispatcherEnv,
  req: DispatchRequest<K>,
): Promise<{ notificationId: string; channels: Channel[] }> {
  // 1. Load type definition
  const { data: typeDef, error: tdErr } = await sb
    .from("notification_types")
    .select("*")
    .eq("key", req.type)
    .single();
  if (tdErr || !typeDef) {
    throw new Error(`Unknown notification type: ${req.type}`);
  }

  // 2. Load recipient + preferences
  const { data: profile } = await sb
    .from("profiles")
    .select("id, email, full_name, locale, role")
    .eq("id", req.recipientId)
    .maybeSingle();
  if (!profile) throw new Error(`Recipient not found: ${req.recipientId}`);

  const { data: pref } = await sb
    .from("notification_preferences")
    .select("channels, digest_only")
    .eq("user_id", req.recipientId)
    .eq("type_key", req.type)
    .maybeSingle();

  // 3. Determine effective channels
  let channels: Channel[] = req.channels ??
    (pref?.channels as Channel[] | undefined) ??
    (typeDef.default_channels as Channel[]);

  // Critical events bypass digest-only preference
  if (pref?.digest_only && !typeDef.is_critical) {
    channels = channels.filter((c) => c !== "email");
  }

  // 4. Render template (subject/title/body)
  const rendered = renderTemplate({
    typeKey: req.type,
    typeDef,
    data: req.data as Record<string, unknown>,
    locale: profile.locale ?? "ja",
    recipient: { name: profile.full_name, email: profile.email },
    actionUrl: req.actionUrl,
    baseUrl: env.APP_BASE_URL,
  });

  // 5. Dedupe key
  const dedupeKey = req.dedupeKey ?? defaultDedupeKey(req.type, req.data);

  // 6. Insert notification row (idempotent via unique index on dedupe_key)
  const { data: inserted, error: insErr } = await sb
    .from("notifications")
    .upsert(
      {
        recipient_id: req.recipientId,
        type_key: req.type,
        category: typeDef.category,
        title: rendered.title,
        body: rendered.bodyText,
        action_url: rendered.actionUrl,
        data: req.data as Record<string, unknown>,
        dedupe_key: dedupeKey,
        channels_attempted: channels,
      },
      { onConflict: "recipient_id,dedupe_key", ignoreDuplicates: true },
    )
    .select("id")
    .maybeSingle();

  if (!inserted) {
    // duplicate; resolve existing id
    const { data: existing } = await sb
      .from("notifications")
      .select("id")
      .eq("recipient_id", req.recipientId)
      .eq("dedupe_key", dedupeKey)
      .single();
    return { notificationId: existing!.id, channels: [] };
  }

  const notificationId = inserted.id;
  const delivered: Channel[] = [];

  // 7. Send per channel; record delivery rows
  for (const channel of channels) {
    if (channel === "in_app") {
      // Already delivered via DB insert + Realtime publication
      await recordDelivery(sb, notificationId, channel, "sent", null);
      delivered.push(channel);
      continue;
    }
    if (channel === "email") {
      try {
        const id = await sendEmail(env, {
          to: profile.email,
          toName: profile.full_name,
          subject: rendered.subject ?? rendered.title,
          html: rendered.html,
          text: rendered.bodyText,
        });
        await recordDelivery(sb, notificationId, "email", "sent", id);
        delivered.push("email");
      } catch (err) {
        await recordDelivery(sb, notificationId, "email", "failed", null, (err as Error).message);
        if (err instanceof TransientNotificationError) {
          // re-throw so queue can retry; but in-app is already delivered
          throw err;
        }
      }
    }
    if (channel === "slack") {
      try {
        const projectId = (req.data as { projectId?: string }).projectId;
        const id = await sendSlack(sb, env, {
          projectId: projectId ?? null,
          title: rendered.title,
          bodyText: rendered.bodyText,
          actionUrl: rendered.actionUrl,
          eventKey: req.type,
        });
        await recordDelivery(sb, notificationId, "slack", id ? "sent" : "skipped", id);
        if (id) delivered.push("slack");
      } catch (err) {
        await recordDelivery(sb, notificationId, "slack", "failed", null, (err as Error).message);
      }
    }
  }

  // 8. Update channels_delivered
  await sb
    .from("notifications")
    .update({ channels_delivered: delivered })
    .eq("id", notificationId);

  return { notificationId, channels: delivered };
}

function defaultDedupeKey(type: string, data: Record<string, unknown>): string {
  const primary =
    (data.articleId as string) ??
    (data.runId as string) ??
    (data.invoiceId as string) ??
    (data.ticketId as string) ??
    (data.subscriptionId as string) ??
    (data.projectId as string) ??
    "";
  return primary ? `${type}:${primary}` : `${type}:${Date.now()}`;
}

async function recordDelivery(
  sb: SupabaseClient,
  notificationId: string,
  channel: Channel,
  status: "sent" | "failed" | "skipped" | "queued",
  providerId: string | null,
  error?: string,
): Promise<void> {
  await sb.from("notification_deliveries").insert({
    notification_id: notificationId,
    channel,
    status,
    provider_id: providerId,
    error,
    attempts: 1,
    attempted_at: new Date().toISOString(),
    delivered_at: status === "sent" ? new Date().toISOString() : null,
  });
}
