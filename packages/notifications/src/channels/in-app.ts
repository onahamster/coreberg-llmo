import type { SupabaseClient } from "@supabase/supabase-js";

export async function getUnreadCount(sb: SupabaseClient, userId: string): Promise<number> {
  const { data } = await sb.rpc("get_unread_notification_count", { p_user_id: userId });
  return Number(data ?? 0);
}

export async function markRead(sb: SupabaseClient, userId: string, ids: string[]): Promise<number> {
  if (ids.length === 0) return 0;
  const { data } = await sb.rpc("mark_notifications_read", {
    p_user_id: userId,
    p_ids: ids,
  });
  return Number(data ?? 0);
}

export async function markAllRead(sb: SupabaseClient, userId: string): Promise<number> {
  const { data, error } = await sb
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("recipient_id", userId)
    .is("read_at", null)
    .select("id");
  if (error) throw error;
  return data?.length ?? 0;
}

export async function archiveNotification(
  sb: SupabaseClient,
  userId: string,
  id: string,
): Promise<void> {
  await sb
    .from("notifications")
    .update({ archived_at: new Date().toISOString() })
    .eq("recipient_id", userId)
    .eq("id", id);
}
