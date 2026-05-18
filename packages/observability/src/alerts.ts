import type { SupabaseClient } from "@supabase/supabase-js";

export type AlertSeverity = "info" | "warning" | "critical";

export interface RaiseAlertInput {
  key: string;
  severity: AlertSeverity;
  title: string;
  detail?: Record<string, unknown>;
}

export async function raiseAlert(sb: SupabaseClient, input: RaiseAlertInput): Promise<string> {
  const { data, error } = await sb.rpc("raise_ops_alert", {
    p_key: input.key, p_severity: input.severity,
    p_title: input.title, p_detail: input.detail ?? {},
  });
  if (error) throw error;
  return String(data);
}

export async function ackAlert(sb: SupabaseClient, id: string, userId: string): Promise<void> {
  await sb.from("ops_alerts").update({ status: "ack", acked_by: userId }).eq("id", id);
}

export async function resolveAlert(sb: SupabaseClient, id: string): Promise<void> {
  await sb.from("ops_alerts").update({ status: "resolved", resolved_at: new Date().toISOString() }).eq("id", id);
}
