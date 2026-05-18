-- ============================================================================
-- 0013_functions_and_triggers.sql
-- 共通トリガー・ストアドファンクションの定義
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. updated_at 自動更新トリガー
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
security definer
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- 対象テーブルにトリガー適用
create trigger trg_profiles_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

create trigger trg_projects_updated_at
  before update on public.projects
  for each row execute function public.set_updated_at();

create trigger trg_article_plans_updated_at
  before update on public.article_plans
  for each row execute function public.set_updated_at();

create trigger trg_articles_updated_at
  before update on public.articles
  for each row execute function public.set_updated_at();

create trigger trg_plans_updated_at
  before update on public.plans
  for each row execute function public.set_updated_at();

create trigger trg_subscriptions_updated_at
  before update on public.subscriptions
  for each row execute function public.set_updated_at();

create trigger trg_support_tickets_updated_at
  before update on public.support_tickets
  for each row execute function public.set_updated_at();

create trigger trg_feature_flags_updated_at
  before update on public.feature_flags
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- 2. なりすまし（Impersonation）セッションの有効性検証・自動クリーンアップ
-- ---------------------------------------------------------------------------
create or replace function public.validate_impersonation_session(p_token_hash text)
returns table (
  is_valid boolean,
  admin_id uuid,
  target_user_id uuid
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session_id uuid;
  v_admin_id uuid;
  v_target_user_id uuid;
  v_expires_at timestamptz;
  v_ended_at timestamptz;
begin
  select id, impersonation_sessions.admin_id, impersonation_sessions.target_user_id, expires_at, ended_at
  into v_session_id, v_admin_id, v_target_user_id, v_expires_at, v_ended_at
  from public.impersonation_sessions
  where token_hash = p_token_hash;

  if v_session_id is null then
    return query select false, null::uuid, null::uuid;
  elsif v_ended_at is not null then
    return query select false, v_admin_id, v_target_user_id;
  elsif now() > v_expires_at then
    -- 期限切れセッションの自動終了処理
    update public.impersonation_sessions
    set ended_at = v_expires_at
    where id = v_session_id;
    return query select false, v_admin_id, v_target_user_id;
  else
    return query select true, v_admin_id, v_target_user_id;
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- 3. インシデント監査ログ記録用ヘルパー
-- ---------------------------------------------------------------------------
create or replace function public.log_audit_event(
  p_action text,
  p_resource_type text,
  p_resource_id text,
  p_target_user_id uuid,
  p_metadata jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_log_id uuid;
  v_actor_id uuid;
  v_actor_role text;
  v_actor_ip inet;
begin
  -- コンテキストからアクター情報（操作した管理者など）を取得
  v_actor_id := nullif(current_setting('app.actor_id', true), '')::uuid;
  v_actor_role := coalesce(nullif(current_setting('app.actor_role', true), ''), 'system');
  v_actor_ip := nullif(current_setting('app.actor_ip', true), '')::inet;

  -- 通常セッションからのアクター情報フォールバック
  if v_actor_id is null and auth.uid() is not null then
    v_actor_id := auth.uid();
    v_actor_role := coalesce(auth.jwt() -> 'app_metadata' ->> 'user_role', 'customer');
  end if;

  insert into public.audit_logs (
    actor_id,
    actor_role,
    actor_ip,
    action,
    resource_type,
    resource_id,
    target_user_id,
    metadata
  ) values (
    v_actor_id,
    v_actor_role,
    v_actor_ip,
    p_action,
    p_resource_type,
    p_resource_id,
    p_target_user_id,
    p_metadata
  ) returning id into v_log_id;

  return v_log_id;
end;
$$;

comment on function public.log_audit_event is
  '監査ログレコードを作成するセキュリティ手続き。admin 操作履歴や API コスト閾値到達などの記録に使用します';
