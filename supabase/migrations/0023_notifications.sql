-- ============================================================================
-- 0023_notifications.sql
-- Coreberg LLMO Notification Catalog, Preferences, Logs and Webhook Encryptions
-- ============================================================================

-- Notification type catalog
create table if not exists public.notification_types (
  key text primary key,
  category text not null check (category in (
    'system','billing','article','monitoring','support','security','digest'
  )),
  default_channels text[] not null default '{in_app,email}',
  description text,
  email_subject_template text,
  is_critical boolean not null default false  -- bypasses user preferences
);

insert into public.notification_types (key, category, default_channels, description, email_subject_template, is_critical) values
  ('article.published',         'article',    '{in_app,email}',    '記事公開完了',           '[Coreberg] {{title}} を公開しました', false),
  ('article.generation_failed', 'article',    '{in_app,email}',    '記事生成失敗',           '[Coreberg] 記事生成エラー: {{title}}', false),
  ('generation_run.completed',  'article',    '{in_app,email}',    '月次生成バッチ完了',     '[Coreberg] 今月の記事生成が完了しました', false),
  ('monitoring.completed',      'monitoring', '{in_app}',          '日次モニタリング完了',   null, false),
  ('learning.ready',            'monitoring', '{in_app,email}',    '月次インサイト準備完了', '[Coreberg] 今月のインサイトが届きました', false),
  ('citation.alert',            'monitoring', '{in_app,email}',    '引用スコア急降下',       '[Coreberg] AI 引用率にアラート', false),
  ('billing.invoice_paid',      'billing',    '{email}',           '請求書支払い完了',       '[Coreberg] 請求書 {{number}} の支払いが完了しました', false),
  ('billing.payment_failed',    'billing',    '{in_app,email}',    '支払い失敗',             '[Coreberg] 支払いに失敗しました', true),
  ('billing.trial_ending',      'billing',    '{in_app,email}',    'トライアル終了予告',     '[Coreberg] トライアルがあと3日で終了します', false),
  ('billing.usage_warning',     'billing',    '{in_app,email}',    '使用量警告',             '[Coreberg] 今月の記事クォータが残り{{remaining}}件です', false),
  ('billing.usage_exceeded',    'billing',    '{in_app,email}',    'クォータ超過',           '[Coreberg] 記事クォータを超過しました', true),
  ('security.new_login',        'security',   '{email}',           '新しい端末からのログイン','[Coreberg] 新しい端末からログインがありました', false),
  ('security.password_changed', 'security',   '{email}',           'パスワード変更',         '[Coreberg] パスワードが変更されました', true),
  ('support.message_received',  'support',    '{in_app,email}',    'サポート返信',           '[Coreberg] サポートから返信があります', false),
  ('digest.weekly',             'digest',     '{email}',           '週次サマリ',             '[Coreberg] 今週の LLMO レポート', false),
  ('admin.cost_spike',          'system',     '{slack}',           'AI コスト急増',          null, true),
  ('admin.webhook_failure',     'system',     '{slack}',           'Webhook 連続失敗',       null, true)
on conflict (key) do update set
  category = excluded.category,
  default_channels = excluded.default_channels,
  description = excluded.description,
  email_subject_template = excluded.email_subject_template,
  is_critical = excluded.is_critical;

-- User notification preferences (per-type opt-out)
create table if not exists public.notification_preferences (
  user_id uuid not null references public.profiles(id) on delete cascade,
  type_key text not null references public.notification_types(key) on delete cascade,
  channels text[] not null,            -- subset of default_channels (or extend)
  digest_only boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key (user_id, type_key)
);

-- The unified notifications table (in-app feed + outbound log)
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid not null references public.profiles(id) on delete cascade,
  type_key text not null references public.notification_types(key),
  category text not null,              -- denormalized for indexing
  title text not null,
  body text,
  action_url text,
  data jsonb not null default '{}'::jsonb,
  dedupe_key text,                     -- e.g. "article.published:{article_id}"
  channels_attempted text[] not null default '{}',
  channels_delivered text[] not null default '{}',
  read_at timestamptz,
  archived_at timestamptz,
  digest_included_in uuid,             -- references notifications.id when rolled up
  created_at timestamptz not null default now()
);
create index if not exists idx_notifications_recipient_unread
  on public.notifications(recipient_id, created_at desc)
  where read_at is null and archived_at is null;
create index if not exists idx_notifications_recipient_all
  on public.notifications(recipient_id, created_at desc);
create unique index if not exists uniq_notifications_dedupe
  on public.notifications(recipient_id, dedupe_key)
  where dedupe_key is not null;

-- Outbound delivery log (per channel attempt, for retry/audit)
create table if not exists public.notification_deliveries (
  id uuid primary key default gen_random_uuid(),
  notification_id uuid not null references public.notifications(id) on delete cascade,
  channel text not null check (channel in ('email','slack','in_app')),
  status text not null check (status in ('queued','sent','failed','skipped')),
  provider_id text,                    -- e.g. Resend message id
  error text,
  attempts integer not null default 0,
  attempted_at timestamptz,
  delivered_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists idx_deliveries_notification on public.notification_deliveries(notification_id);
create index if not exists idx_deliveries_status on public.notification_deliveries(status, created_at)
  where status in ('queued','failed');

-- Atomic mark-as-read
create or replace function public.mark_notifications_read(
  p_user_id uuid,
  p_ids uuid[]
) returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
begin
  with updated as (
    update public.notifications
       set read_at = now()
     where recipient_id = p_user_id
       and id = any(p_ids)
       and read_at is null
     returning 1
  )
  select count(*) into v_count from updated;
  return v_count;
end;

$$;

grant execute on function public.mark_notifications_read(uuid, uuid[]) to authenticated;

-- Unread count
create or replace function public.get_unread_notification_count(p_user_id uuid)
returns integer
language sql
stable
as $$
  select count(*)::int from public.notifications
   where recipient_id = p_user_id
     and read_at is null
     and archived_at is null;

$$;

grant execute on function public.get_unread_notification_count(uuid) to authenticated;

-- Slack webhook config per project (or global for admin alerts)
create table if not exists public.slack_integrations (
  id uuid primary key default gen_random_uuid(),
  scope text not null check (scope in ('project','global')),
  project_id uuid references public.projects(id) on delete cascade,
  webhook_url_encrypted bytea not null,
  channel text,
  event_filters text[] default '{}',
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  unique (project_id) -- one per project; null for global
);

create or replace function public.slack_set_webhook(
  p_scope text,
  p_project_id uuid,
  p_url text,
  p_channel text,
  p_filters text[]
) returns uuid
language plpgsql
security definer
set search_path = public, pgsodium
as $$
declare
  v_key_id uuid;
  v_id uuid;
  v_aad text;
begin
  select id into v_key_id from pgsodium.key where name = 'coreberg_default';
  v_aad := coalesce(p_project_id::text, 'global');
  insert into public.slack_integrations (scope, project_id, webhook_url_encrypted, channel, event_filters)
       values (p_scope, p_project_id,
               pgsodium.crypto_aead_det_encrypt(convert_to(p_url, 'utf8'), convert_to(v_aad, 'utf8'), v_key_id),
               p_channel, coalesce(p_filters, '{}'))
  on conflict (project_id) do update set
    webhook_url_encrypted = excluded.webhook_url_encrypted,
    channel = excluded.channel,
    event_filters = excluded.event_filters
  returning id into v_id;
  return v_id;
end;

$$;

create or replace function public.slack_get_webhook(p_project_id uuid)
returns table(webhook_url text, channel text, event_filters text[])
language plpgsql
security definer
set search_path = public, pgsodium
as $$
declare
  v_key_id uuid;
  v_aad text;
  v_cipher bytea;
  v_channel text;
  v_filters text[];
begin
  select id into v_key_id from pgsodium.key where name = 'coreberg_default';
  v_aad := coalesce(p_project_id::text, 'global');
  select webhook_url_encrypted, channel, event_filters
    into v_cipher, v_channel, v_filters
    from public.slack_integrations
   where (p_project_id is null and scope = 'global' and project_id is null)
      or (project_id = p_project_id);
  if v_cipher is null then return; end if;
  return query select
    convert_from(pgsodium.crypto_aead_det_decrypt(v_cipher, convert_to(v_aad, 'utf8'), v_key_id), 'utf8'),
    v_channel, v_filters;
end;

$$;

revoke all on function public.slack_set_webhook(text, uuid, text, text, text[]) from public;
revoke all on function public.slack_get_webhook(uuid) from public;
grant execute on function public.slack_set_webhook(text, uuid, text, text, text[]) to service_role;
grant execute on function public.slack_get_webhook(uuid) to service_role;

-- RLS
alter table public.notifications enable row level security;
create policy notifications_owner_read on public.notifications
  for select using (recipient_id = auth.uid());
create policy notifications_owner_update on public.notifications
  for update using (recipient_id = auth.uid())
  with check (recipient_id = auth.uid());

alter table public.notification_preferences enable row level security;
create policy nprefs_owner_all on public.notification_preferences
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

alter table public.notification_deliveries enable row level security;
-- service_role only; no policies for authenticated

alter table public.slack_integrations enable row level security;
create policy slack_admin on public.slack_integrations
  for all using (public.is_admin()) with check (public.is_admin());

-- Enable Realtime publication
alter publication supabase_realtime add table public.notifications;
