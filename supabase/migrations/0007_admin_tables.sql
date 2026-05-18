-- ============================================================================
-- 0007_admin_tables.sql
-- ai_usage / cost_alerts / prompt_versions / prompt_ab_tests /
-- feature_flags / support_tickets / support_messages
-- ============================================================================

-- ---------------------------------------------------------------------------
-- ai_usage: 全 AI API 呼び出しの記録（コスト管理）
-- ---------------------------------------------------------------------------
create table public.ai_usage (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete set null,
  project_id uuid references public.projects(id) on delete set null,
  generation_run_id uuid references public.generation_runs(id) on delete set null,
  article_id uuid references public.articles(id) on delete set null,
  step text not null,
  model text not null,
  input_tokens int not null default 0,
  output_tokens int not null default 0,
  thinking_tokens int not null default 0,
  grounding_requests int not null default 0,
  image_count int not null default 0,
  cost_cents int not null default 0,
  latency_ms int,
  cache_hit boolean not null default false,
  ai_gateway_log_id text,
  created_at timestamptz not null default now()
);

create index idx_ai_usage_user_date
  on public.ai_usage(user_id, created_at desc);

create index idx_ai_usage_model_date
  on public.ai_usage(model, created_at desc);

create index idx_ai_usage_run
  on public.ai_usage(generation_run_id);

create index idx_ai_usage_article
  on public.ai_usage(article_id);

create index idx_ai_usage_step_date
  on public.ai_usage(step, created_at desc);

-- ---------------------------------------------------------------------------
create table public.cost_alerts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete cascade,
  threshold_cents int not null check (threshold_cents > 0),
  period text not null check (period in ('daily','monthly')),
  triggered_at timestamptz,
  notified boolean not null default false,
  notification_channel text not null default 'email'
    check (notification_channel in ('email','slack')),
  created_at timestamptz not null default now()
);

create index idx_cost_alerts_user
  on public.cost_alerts(user_id);

-- ---------------------------------------------------------------------------
-- prompt_versions: プロンプトのバージョン管理
-- ---------------------------------------------------------------------------
create table public.prompt_versions (
  id uuid primary key default gen_random_uuid(),
  key text not null,
  version int not null,
  system_prompt text not null,
  user_template text,
  schema_jsonb jsonb,
  model text not null,
  thinking_level text
    check (thinking_level in ('minimal','low','medium','high') or thinking_level is null),
  is_active boolean not null default false,
  created_by uuid references public.profiles(id) on delete set null,
  notes text,
  created_at timestamptz not null default now()
);

create unique index idx_prompt_versions_key_version
  on public.prompt_versions(key, version);

create unique index idx_prompt_versions_active
  on public.prompt_versions(key)
  where is_active = true;

-- ---------------------------------------------------------------------------
create table public.prompt_ab_tests (
  id uuid primary key default gen_random_uuid(),
  key text not null,
  variant_a_id uuid not null references public.prompt_versions(id) on delete cascade,
  variant_b_id uuid not null references public.prompt_versions(id) on delete cascade,
  traffic_split numeric(3,2) not null default 0.50
    check (traffic_split between 0 and 1),
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  winner text check (winner in ('a','b','none') or winner is null),
  metrics_jsonb jsonb
);

create index idx_prompt_ab_tests_key_active
  on public.prompt_ab_tests(key)
  where ended_at is null;

-- ---------------------------------------------------------------------------
create table public.feature_flags (
  key text primary key,
  description text,
  enabled boolean not null default false,
  rollout_percentage int not null default 0
    check (rollout_percentage between 0 and 100),
  allowed_user_ids uuid[] not null default array[]::uuid[],
  updated_by uuid references public.profiles(id) on delete set null,
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
create table public.support_tickets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  assigned_to uuid references public.profiles(id) on delete set null,
  subject text not null,
  status text not null default 'open'
    check (status in ('open','in_progress','resolved','closed')),
  priority text not null default 'normal'
    check (priority in ('low','normal','high','urgent')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  resolved_at timestamptz
);

create index idx_support_tickets_user
  on public.support_tickets(user_id, created_at desc);

create index idx_support_tickets_assigned
  on public.support_tickets(assigned_to, status)
  where status in ('open','in_progress');

create index idx_support_tickets_status
  on public.support_tickets(status, priority);

-- ---------------------------------------------------------------------------
create table public.support_messages (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.support_tickets(id) on delete cascade,
  author_id uuid not null references public.profiles(id) on delete cascade,
  body text not null,
  is_internal boolean not null default false,
  attachments jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create index idx_support_messages_ticket
  on public.support_messages(ticket_id, created_at);
