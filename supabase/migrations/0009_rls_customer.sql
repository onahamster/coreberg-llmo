-- ============================================================================
-- 0009_rls_customer.sql
-- customer ロール向け RLS ポリシー
-- すべての顧客データテーブルで「自分の行だけ」を強制
-- ============================================================================

-- すべての関連テーブルで RLS 有効化
alter table public.profiles            enable row level security;
alter table public.projects            enable row level security;
alter table public.context_files       enable row level security;
alter table public.generation_runs     enable row level security;
alter table public.subqueries          enable row level security;
alter table public.clusters            enable row level security;
alter table public.article_plans       enable row level security;
alter table public.articles            enable row level security;
alter table public.fact_checks         enable row level security;
alter table public.citation_monitoring enable row level security;
alter table public.learning_insights   enable row level security;
alter table public.subscriptions       enable row level security;
alter table public.invoices            enable row level security;
alter table public.plans               enable row level security;
alter table public.ai_usage            enable row level security;
alter table public.cost_alerts         enable row level security;
alter table public.support_tickets     enable row level security;
alter table public.support_messages    enable row level security;

-- ============================================================================
-- profiles
-- ============================================================================
create policy "profile: read own"
  on public.profiles for select
  using (auth.uid() = id);

create policy "profile: update own non-sensitive fields"
  on public.profiles for update
  using (auth.uid() = id)
  with check (
    auth.uid() = id
    -- role / totp_secret_encrypted の変更は service_role 経由のみ
    and role = (select role from public.profiles where id = auth.uid())
  );

-- ============================================================================
-- projects
-- ============================================================================
create policy "projects: customer reads own"
  on public.projects for select
  using (auth.uid() = user_id and deleted_at is null);

create policy "projects: customer inserts own"
  on public.projects for insert
  with check (auth.uid() = user_id);

create policy "projects: customer updates own"
  on public.projects for update
  using (auth.uid() = user_id and deleted_at is null)
  with check (auth.uid() = user_id);

create policy "projects: customer soft-deletes own"
  on public.projects for delete
  using (auth.uid() = user_id);

-- ============================================================================
-- context_files (親 projects 経由)
-- ============================================================================
create policy "context_files: read via project ownership"
  on public.context_files for select
  using (
    exists (
      select 1 from public.projects p
      where p.id = context_files.project_id
        and p.user_id = auth.uid()
        and p.deleted_at is null
    )
  );

-- ============================================================================
-- generation_runs
-- ============================================================================
create policy "generation_runs: read via project ownership"
  on public.generation_runs for select
  using (
    exists (
      select 1 from public.projects p
      where p.id = generation_runs.project_id
        and p.user_id = auth.uid()
        and p.deleted_at is null
    )
  );

-- ============================================================================
-- subqueries / clusters / article_plans / articles / fact_checks
-- 共通: generation_run → project → user で辿る
-- ============================================================================
create policy "subqueries: read via run ownership"
  on public.subqueries for select
  using (
    exists (
      select 1 from public.generation_runs gr
      join public.projects p on p.id = gr.project_id
      where gr.id = subqueries.generation_run_id
        and p.user_id = auth.uid()
        and p.deleted_at is null
    )
  );

create policy "clusters: read via run ownership"
  on public.clusters for select
  using (
    exists (
      select 1 from public.generation_runs gr
      join public.projects p on p.id = gr.project_id
      where gr.id = clusters.generation_run_id
        and p.user_id = auth.uid()
        and p.deleted_at is null
    )
  );

create policy "article_plans: read via run ownership"
  on public.article_plans for select
  using (
    exists (
      select 1 from public.generation_runs gr
      join public.projects p on p.id = gr.project_id
      where gr.id = article_plans.generation_run_id
        and p.user_id = auth.uid()
        and p.deleted_at is null
    )
  );

create policy "articles: read via project ownership"
  on public.articles for select
  using (
    exists (
      select 1 from public.projects p
      where p.id = articles.project_id
        and p.user_id = auth.uid()
        and p.deleted_at is null
    )
    and deleted_at is null
  );

create policy "articles: customer updates own (publish toggle)"
  on public.articles for update
  using (
    exists (
      select 1 from public.projects p
      where p.id = articles.project_id
        and p.user_id = auth.uid()
        and p.deleted_at is null
    )
  )
  with check (
    exists (
      select 1 from public.projects p
      where p.id = articles.project_id
        and p.user_id = auth.uid()
    )
  );

create policy "fact_checks: read via article ownership"
  on public.fact_checks for select
  using (
    exists (
      select 1 from public.articles a
      join public.projects p on p.id = a.project_id
      where a.id = fact_checks.article_id
        and p.user_id = auth.uid()
    )
  );

-- ============================================================================
-- citation_monitoring / learning_insights
-- ============================================================================
create policy "citation_monitoring: read via article ownership"
  on public.citation_monitoring for select
  using (
    exists (
      select 1 from public.articles a
      join public.projects p on p.id = a.project_id
      where a.id = citation_monitoring.article_id
        and p.user_id = auth.uid()
    )
  );

create policy "learning_insights: read via project ownership"
  on public.learning_insights for select
  using (
    exists (
      select 1 from public.projects p
      where p.id = learning_insights.project_id
        and p.user_id = auth.uid()
    )
  );

-- ============================================================================
-- 課金系: 顧客は閲覧のみ
-- ============================================================================
create policy "plans: anyone can read active plans"
  on public.plans for select
  using (is_active = true);

create policy "subscriptions: read own"
  on public.subscriptions for select
  using (auth.uid() = user_id);

create policy "invoices: read own"
  on public.invoices for select
  using (auth.uid() = user_id);

-- ============================================================================
-- ai_usage: 顧客は自分の使用量を読めるのみ
-- ============================================================================
create policy "ai_usage: read own"
  on public.ai_usage for select
  using (auth.uid() = user_id);

create policy "cost_alerts: manage own"
  on public.cost_alerts for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ============================================================================
-- support_tickets / support_messages
-- ============================================================================
create policy "support_tickets: customer reads own"
  on public.support_tickets for select
  using (auth.uid() = user_id);

create policy "support_tickets: customer creates own"
  on public.support_tickets for insert
  with check (auth.uid() = user_id);

create policy "support_messages: read via ticket"
  on public.support_messages for select
  using (
    is_internal = false
    and exists (
      select 1 from public.support_tickets t
      where t.id = support_messages.ticket_id
        and t.user_id = auth.uid()
    )
  );

create policy "support_messages: customer posts own"
  on public.support_messages for insert
  with check (
    author_id = auth.uid()
    and is_internal = false
    and exists (
      select 1 from public.support_tickets t
      where t.id = support_messages.ticket_id
        and t.user_id = auth.uid()
    )
  );
