-- ============================================================================
-- 0004_articles_and_pipeline.sql
-- subqueries / clusters / article_plans / articles / fact_checks
-- ============================================================================

-- ---------------------------------------------------------------------------
-- subqueries: Step 3 で生成された 105 件のサブクエリ
-- ---------------------------------------------------------------------------
create table public.subqueries (
  id uuid primary key default gen_random_uuid(),
  generation_run_id uuid not null references public.generation_runs(id) on delete cascade,
  pattern text not null
    check (pattern in ('related','implicit','comparative','recency',
                       'reformulation','contextual','next_step')),
  text text not null,
  citation_likelihood numeric(5,2)
    check (citation_likelihood between 0 and 100),
  competitor_weakness numeric(5,2)
    check (competitor_weakness between 0 and 100),
  topic_contribution numeric(5,2)
    check (topic_contribution between 0 and 100),
  citation_score numeric(5,2)
    check (citation_score between 0 and 100),
  cluster_id uuid,
  selected boolean not null default false,
  created_at timestamptz not null default now()
);

create index idx_subqueries_run
  on public.subqueries(generation_run_id);

create index idx_subqueries_selected
  on public.subqueries(generation_run_id, selected)
  where selected = true;

create index idx_subqueries_cluster
  on public.subqueries(cluster_id);

-- ---------------------------------------------------------------------------
-- clusters: Step 4C のキーワードクラスタ
-- ---------------------------------------------------------------------------
create table public.clusters (
  id uuid primary key default gen_random_uuid(),
  generation_run_id uuid not null references public.generation_runs(id) on delete cascade,
  name text not null,
  pillar_subquery_id uuid references public.subqueries(id) on delete set null,
  created_at timestamptz not null default now()
);

create index idx_clusters_run
  on public.clusters(generation_run_id);

-- subqueries.cluster_id への FK を後付け（循環参照回避）
alter table public.subqueries
  add constraint fk_subqueries_cluster
  foreign key (cluster_id) references public.clusters(id) on delete set null;

-- ---------------------------------------------------------------------------
-- article_plans: Step 5 の記事プラン
-- ---------------------------------------------------------------------------
create table public.article_plans (
  id uuid primary key default gen_random_uuid(),
  generation_run_id uuid not null references public.generation_runs(id) on delete cascade,
  subquery_id uuid not null references public.subqueries(id) on delete cascade,
  plan_jsonb jsonb not null,
  version int not null default 1,
  status text not null default 'draft'
    check (status in ('draft','approved','generating','completed','failed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_article_plans_run
  on public.article_plans(generation_run_id);

create index idx_article_plans_status
  on public.article_plans(status);

-- ---------------------------------------------------------------------------
-- articles: Step 6 の生成記事
-- ---------------------------------------------------------------------------
create table public.articles (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.article_plans(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  title text not null,
  slug text,
  html text,
  schema_jsonb jsonb,
  image_url text,
  image_alt text,
  word_count int,
  status text not null default 'pending'
    check (status in ('pending','drafting','checking','fact_checking',
                      'finalizing','completed','failed','published')),
  wp_post_id bigint,
  wp_post_url text,
  published_at timestamptz,
  cost_cents int not null default 0,
  error_message text,
  retry_count int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index idx_articles_project
  on public.articles(project_id)
  where deleted_at is null;

create index idx_articles_plan
  on public.articles(plan_id);

create index idx_articles_status
  on public.articles(status);

create index idx_articles_published
  on public.articles(project_id, published_at desc)
  where status = 'published';

-- ---------------------------------------------------------------------------
-- fact_checks: Step 6.3 の事実検証ログ
-- ---------------------------------------------------------------------------
create table public.fact_checks (
  id uuid primary key default gen_random_uuid(),
  article_id uuid not null references public.articles(id) on delete cascade,
  claim text not null,
  verified boolean not null,
  source_url text,
  action_taken text
    check (action_taken in ('kept','generalized','removed')),
  created_at timestamptz not null default now()
);

create index idx_fact_checks_article
  on public.fact_checks(article_id);

create index idx_fact_checks_verified
  on public.fact_checks(article_id, verified);
