import type { SupabaseClient } from "@supabase/supabase-js";
import { TransientNotificationError } from "../errors";

export interface SlackEnv {
  // No global env required; webhook URLs are stored per-project (encrypted)
  // unless this is admin-only and SLACK_ADMIN_WEBHOOK_URL is set
  SLACK_ADMIN_WEBHOOK_URL?: string;
}

export interface SendSlackInput {
  projectId: string | null;     // null = global/admin
  title: string;
  bodyText: string;
  actionUrl?: string;
  eventKey: string;
}

interface SlackBlock {
  type: string;
  text?: { type: string; text: string };
  elements?: unknown[];
}

export async function sendSlack(
  sb: SupabaseClient,
  env: SlackEnv,
  input: SendSlackInput,
): Promise<string | null> {
  let webhookUrl: string | null = null;
  let filters: string[] = [];

  if (input.projectId) {
    const { data } = await sb.rpc("slack_get_webhook", { p_project_id: input.projectId });
    const row = (data as Array<{ webhook_url: string; channel: string; event_filters: string[] }> | null)?.[0];
    if (!row) return null;
    webhookUrl = row.webhook_url;
    filters = row.event_filters ?? [];
  } else {
    webhookUrl = env.SLACK_ADMIN_WEBHOOK_URL ?? null;
  }
  if (!webhookUrl) return null;

  // Respect per-integration filters (if any specified, must include eventKey)
  if (filters.length > 0 && !filters.includes(input.eventKey)) return null;

  const blocks: SlackBlock[] = [
    { type: "header", text: { type: "plain_text", text: input.title.slice(0, 150) } },
    { type: "section", text: { type: "mrkdwn", text: input.bodyText.slice(0, 2900) } },
  ];
  if (input.actionUrl) {
    blocks.push({
      type: "actions",
      elements: [
        {
          type: "button",
          text: { type: "plain_text", text: "詳細を開く" },
          url: input.actionUrl,
          style: "primary",
        },
      ],
    });
  }
  blocks.push({
    type: "context",
    elements: [{ type: "mrkdwn", text: `event: \`${input.eventKey}\`` }],
  });

  const res = await fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text: input.title, blocks }),
  });
  if (res.status === 429 || res.status >= 500) {
    throw new TransientNotificationError(`Slack ${res.status}`);
  }
  if (!res.ok) throw new Error(`Slack failed: ${res.status} ${await res.text()}`);
  return "ok";
}
