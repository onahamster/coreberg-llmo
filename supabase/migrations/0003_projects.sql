-- ============================================================================
-- 0003_projects.sql
-- projects / context_files / generation_runs
-- ============================================================================

create table public.projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  site_url text not null,
  site_profile_jsonb jsonb,
  audit_jsonb jsonb,
  -- WordPress 接続情報
  wp_endpoint text,
  wp_username text,
  wp_app_password_encrypted bytea,
  -- 設定
  target_audience text,
  target_locale text not null default 'ja'
    check (target_locale in ('ja','en')),
  monthly_article_count int not null default 30
    check (monthly_article_count between 1 and 100),
  status text not null default 'active'
    check (status in ('active','paused','archived')),
  -- メタ
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,

  constraint chk_site_url_format
    check (site_url ~* '^https?://[^[:space:]]+$')
);

create index idx_projects_user
  on public.projects(user_id)
  where deleted_at is null;

create index idx_projects_status
  on public.projects(status)
  where deleted_at is null;

comment on column public.projects.wp_app_password_encrypted is
  'pgsodium で暗号化された WordPress Application Password';

-- ---------------------------------------------------------------------------
-- context_files: Step 2 の統合リサーチ結果（バージョン管理）
-- ---------------------------------------------------------------------------
create table public.context_files (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  version int not null,
  jsonb jsonb not null,
  size_bytes int generated always as (octet_length(jsonb::text)) stored,
  created_at timestamptz not null default now()
);

create unique index idx_context_files_project_version
  on public.context_files(project_id, version);

-- ---------------------------------------------------------------------------
-- generation_runs: 月次生成バッチの実行履歴
-- ---------------------------------------------------------------------------
create table public.generation_runs (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  month date not null,
  status text not null default 'pending'
    check (status in ('pending','running','completed','failed','cancelled')),
  current_step text,
  total_cost_cents int not null default 0,
  total_tokens_input bigint not null default 0,
  total_tokens_output bigint not null default 0,
  workflow_instance_id text,
  started_at timestamptz,
  finished_at timestamptz,
  error_jsonb jsonb,
  created_at timestamptz not null default now(),

  constraint chk_month_is_first_of_month
    check (extract(day from month) = 1)
);

create unique index idx_generation_runs_project_month
  on public.generation_runs(project_id, month);

create index idx_generation_runs_status
  on public.generation_runs(status)
  where status in ('pending','running');
