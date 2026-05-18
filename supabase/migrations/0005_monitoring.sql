-- ============================================================================
-- 0005_monitoring.sql
-- citation_monitoring (パーティション) / learning_insights
-- ============================================================================

-- ---------------------------------------------------------------------------
-- citation_monitoring: 日次の引用チェック結果（月次パーティション）
-- ---------------------------------------------------------------------------
create table public.citation_monitoring (
  id uuid not null default gen_random_uuid(),
  article_id uuid not null,
  subquery_id uuid,
  engine text not null
    check (engine in ('chatgpt','perplexity','gemini','google_ai_overview')),
  cited boolean not null,
  position int,
  snippet text,
  competitor_domains text[],
  raw_response_jsonb jsonb,
  checked_at timestamptz not null default now(),
  primary key (id, checked_at)
) partition by range (checked_at);

create index idx_cm_article_checked
  on public.citation_monitoring(article_id, checked_at desc);

create index idx_cm_engine_checked
  on public.citation_monitoring(engine, checked_at desc);

create index idx_cm_cited
  on public.citation_monitoring(article_id, cited, checked_at desc)
  where cited = true;

-- パーティション自動作成（pg_partman）
select partman.create_parent(
  p_parent_table => 'public.citation_monitoring',
  p_control => 'checked_at',
  p_type => 'range',
  p_interval => '1 month',
  p_premake => 3
);

-- 古いパーティションは 24 か月で自動削除
update partman.part_config
set retention = '24 months',
    retention_keep_table = false,
    infinite_time_partitions = true
where parent_table = 'public.citation_monitoring';

-- ---------------------------------------------------------------------------
-- learning_insights: Step 9 の月次学習ループ結果
-- ---------------------------------------------------------------------------
create table public.learning_insights (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  month date not null,
  patterns_jsonb jsonb not null,
  prompt_diff_jsonb jsonb,
  applied boolean not null default false,
  created_at timestamptz not null default now(),

  constraint chk_li_month_first
    check (extract(day from month) = 1)
);

create unique index idx_learning_insights_project_month
  on public.learning_insights(project_id, month);
