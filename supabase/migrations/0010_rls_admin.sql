-- ============================================================================
-- 0010_rls_admin.sql
-- 管理者ロール向け RLS ポリシー（読み取りのみバイパス、書き込みは service_role 経由）
-- ============================================================================

-- 管理者判定ヘルパー
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (auth.jwt() -> 'app_metadata' ->> 'user_role'),
    (auth.jwt() ->> 'user_role')
  ) in ('support','admin','super_admin');
$$;

create or replace function public.is_super_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (auth.jwt() -> 'app_metadata' ->> 'user_role'),
    (auth.jwt() ->> 'user_role')
  ) = 'super_admin';
$$;

-- ============================================================================
-- admin: 全顧客データを SELECT 可能
-- ============================================================================
create policy "admin: read all profiles"
  on public.profiles for select
  using (public.is_admin());

create policy "admin: read all projects"
  on public.projects for select
  using (public.is_admin());

create policy "admin: read all context_files"
  on public.context_files for select
  using (public.is_admin());

create policy "admin: read all generation_runs"
  on public.generation_runs for select
  using (public.is_admin());

create policy "admin: read all subqueries"
  on public.subqueries for select
  using (public.is_admin());

create policy "admin: read all clusters"
  on public.clusters for select
  using (public.is_admin());

create policy "admin: read all article_plans"
  on public.article_plans for select
  using (public.is_admin());

create policy "admin: read all articles"
  on public.articles for select
  using (public.is_admin());

create policy "admin: read all fact_checks"
  on public.fact_checks for select
  using (public.is_admin());

create policy "admin: read all citation_monitoring"
  on public.citation_monitoring for select
  using (public.is_admin());

create policy "admin: read all learning_insights"
  on public.learning_insights for select
  using (public.is_admin());

create policy "admin: read all subscriptions"
  on public.subscriptions for select
  using (public.is_admin());

create policy "admin: read all invoices"
  on public.invoices for select
  using (public.is_admin());

create policy "admin: read all ai_usage"
  on public.ai_usage for select
  using (public.is_admin());

create policy "admin: read all support_tickets"
  on public.support_tickets for select
  using (public.is_admin());

create policy "admin: read all support_messages"
  on public.support_messages for select
  using (public.is_admin());

-- ============================================================================
-- 管理者専用テーブル
-- ============================================================================
alter table public.role_history             enable row level security;
alter table public.prompt_versions          enable row level security;
alter table public.prompt_ab_tests          enable row level security;
alter table public.feature_flags            enable row level security;
alter table public.audit_logs               enable row level security;
alter table public.impersonation_sessions   enable row level security;

create policy "role_history: admin read"
  on public.role_history for select
  using (public.is_admin());

create policy "prompt_versions: admin read"
  on public.prompt_versions for select
  using (public.is_admin());

create policy "prompt_ab_tests: admin read"
  on public.prompt_ab_tests for select
  using (public.is_admin());

create policy "feature_flags: admin read"
  on public.feature_flags for select
  using (public.is_admin());

create policy "audit_logs: admin read"
  on public.audit_logs for select
  using (public.is_admin());

create policy "impersonation_sessions: admin read"
  on public.impersonation_sessions for select
  using (public.is_admin());

-- ============================================================================
-- support_messages: 管理者は内部メモも書き込める
-- ============================================================================
create policy "support_messages: admin posts"
  on public.support_messages for insert
  with check (
    public.is_admin()
    and author_id = auth.uid()
  );

create policy "support_messages: admin reads internal"
  on public.support_messages for select
  using (public.is_admin());

-- ============================================================================
-- 注意:
--   write 系 (INSERT/UPDATE/DELETE) は基本的に service_role キー経由で行う。
--   service_role は RLS をバイパスするため、上記ポリシーは必要ない。
--   Worker 側で必ず is_admin() を再検証してから DB アクセスする責務を持つ。
-- ============================================================================
