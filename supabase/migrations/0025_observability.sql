-- ============================================================================
-- 0025_observability.sql
-- Coreberg LLMO Observability & Feature Flags & Alerts & Tracing
-- ============================================================================

-- Application logs
create table if not exists public.app_logs (
  id bigserial,
  ts timestamptz not null default now(),
  level text not null check (level in ('debug','info','warn','error','fatal')),
  source text not null,                 -- "web", "admin", "workers", "billing", ...
  event text not null,                  -- short machine name e.g. "article.published"
  message text,
  user_id uuid references public.profiles(id) on delete set null,
  project_id uuid references public.projects(id) on delete set null,
  request_id text,
  trace_id text,
  attributes jsonb not null default '{}'::jsonb,
  error_class text,
  error_stack text,
  primary key (id, ts)
) partition by range (ts);

create index idx_app_logs_level_ts on public.app_logs (level, ts desc);
create index idx_app_logs_event on public.app_logs (event, ts desc);
create index idx_app_logs_user on public.app_logs (user_id, ts desc) where user_id is not null;
create index idx_app_logs_project on public.app_logs (project_id, ts desc) where project_id is not null;
create index idx_app_logs_trace on public.app_logs (trace_id) where trace_id is not null;

-- Per-request traces for SLO computation
create table if not exists public.request_traces (
  id bigserial,
  ts timestamptz not null default now(),
  trace_id text not null,
  source text not null,
  route text not null,                  -- normalized e.g. "/api/projects/[id]"
  method text not null,
  status_code integer not null,
  duration_ms integer not null,
  user_id uuid,
  project_id uuid,
  attributes jsonb not null default '{}'::jsonb,
  primary key (id, ts)
) partition by range (ts);

create index idx_traces_route_ts on public.request_traces (route, ts desc);
create index idx_traces_status_ts on public.request_traces (status_code, ts desc);
create index idx_traces_slow on public.request_traces (duration_ms desc, ts desc)
  where duration_ms > 1000;

-- Simple partitioning fallback triggers (since pg_partman might not be in standard sandbox installations)
-- We will create default partitions to guarantee inserts succeed without requiring full pg_partman setup.
create table if not exists public.app_logs_default partition of public.app_logs default;
create table if not exists public.request_traces_default partition of public.request_traces default;

-- 5-minute rollup for SLO dashboard
create table if not exists public.request_metrics_5m_cache (
  bucket timestamptz not null,
  source text not null,
  route text not null,
  request_count bigint not null default 0,
  error_count bigint not null default 0,
  client_error_count bigint not null default 0,
  p50 double precision not null default 0,
  p95 double precision not null default 0,
  p99 double precision not null default 0,
  primary key (bucket, source, route)
);
create index idx_request_metrics_5m_bucket on public.request_metrics_5m_cache (bucket desc);

-- Since we want dynamic, real-time-like rollups without materialization lag in sandbox,
-- we'll create a helper view that aggregates request_traces on the fly, falling back to cached rollups
create or replace view public.request_metrics_5m as
  select date_trunc('minute', ts) - (extract(minute from ts)::int % 5) * interval '1 minute' as bucket,
         source, route,
         count(*)::bigint as request_count,
         count(*) filter (where status_code >= 500)::bigint as error_count,
         count(*) filter (where status_code >= 400 and status_code < 500)::bigint as client_error_count,
         percentile_cont(0.5)  within group (order by duration_ms)::double precision as p50,
         percentile_cont(0.95) within group (order by duration_ms)::double precision as p95,
         percentile_cont(0.99) within group (order by duration_ms)::double precision as p99
    from public.request_traces
   where ts >= now() - interval '14 days'
   group by 1, 2, 3;

-- Refresh function (mocked or inserts snapshot to cache for performance)
create or replace function public.refresh_request_metrics()
returns void language plpgsql security definer as $$
begin
  insert into public.request_metrics_5m_cache
  select * from public.request_metrics_5m
  on conflict (bucket, source, route) do update set
    request_count = excluded.request_count,
    error_count = excluded.error_count,
    client_error_count = excluded.client_error_count,
    p50 = excluded.p50,
    p95 = excluded.p95,
    p99 = excluded.p99;
end $$;
grant execute on function public.refresh_request_metrics() to service_role;

-- AI cost ledger daily rollup table
create table if not exists public.ai_cost_daily_cache (
  day date not null,
  model text not null,
  step text not null,
  project_key text not null,
  input_tokens bigint not null default 0,
  output_tokens bigint not null default 0,
  cost_cents bigint not null default 0,
  call_count bigint not null default 0,
  primary key (day, model, step, project_key)
);
create index idx_ai_cost_daily_day on public.ai_cost_daily_cache (day desc);

-- Real-time AI daily view
create or replace view public.ai_cost_daily as
  select date_trunc('day', created_at)::date as day,
         model,
         step,
         coalesce(project_id::text, 'no_project') as project_key,
         sum(input_tokens)::bigint as input_tokens,
         sum(output_tokens)::bigint as output_tokens,
         sum(cost_cents)::bigint as cost_cents,
         count(*)::bigint as call_count
    from public.ai_usage
   where created_at >= now() - interval '90 days'
   group by 1, 2, 3, 4;

create or replace function public.refresh_ai_cost_daily()
returns void language plpgsql security definer as $$
begin
  insert into public.ai_cost_daily_cache
  select * from public.ai_cost_daily
  on conflict (day, model, step, project_key) do update set
    input_tokens = excluded.input_tokens,
    output_tokens = excluded.output_tokens,
    cost_cents = excluded.cost_cents,
    call_count = excluded.call_count;
end $$;
grant execute on function public.refresh_ai_cost_daily() to service_role;

-- Feature flags
create table if not exists public.feature_flags (
  key text primary key,
  description text,
  enabled boolean not null default false,
  rollout_percent smallint not null default 0 check (rollout_percent between 0 and 100),
  allowed_user_ids uuid[] not null default '{}',
  allowed_plans text[] not null default '{}',
  disallowed_user_ids uuid[] not null default '{}',
  variants jsonb not null default '{}'::jsonb,    -- {"A":50,"B":50} for A/B
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles(id) on delete set null
);

create or replace trigger trg_feature_flags_updated
  before update on public.feature_flags
  for each row execute function public.set_updated_at();

insert into public.feature_flags (key, description, enabled, rollout_percent) values
  ('article.bulk_publish', '記事の一括公開 UI', false, 0),
  ('monitoring.real_time_alerts', '引用率のリアルタイムアラート', false, 0),
  ('billing.annual_plan', '年額プラン表示', false, 0),
  ('admin.cost_forecast', '管理画面: AI コスト予測', true, 100)
on conflict (key) do update set
  description = excluded.description,
  enabled = excluded.enabled,
  rollout_percent = excluded.rollout_percent;

-- Health probes — external endpoints we ping to verify dependencies
create table if not exists public.health_probes (
  id bigserial primary key,
  ts timestamptz not null default now(),
  probe_key text not null,              -- "supabase","stripe","resend","openai", ...
  ok boolean not null,
  status_code integer,
  duration_ms integer,
  error text
);
create index idx_health_probes_key_ts on public.health_probes (probe_key, ts desc);

-- Operational alerts (de-duplicated)
create table if not exists public.ops_alerts (
  id uuid primary key default gen_random_uuid(),
  key text not null,                    -- "ai_cost.daily_spike", "queue.backlog", ...
  severity text not null check (severity in ('info','warning','critical')),
  title text not null,
  detail jsonb not null default '{}'::jsonb,
  status text not null default 'open' check (status in ('open','ack','resolved','suppressed')),
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  resolved_at timestamptz,
  acked_by uuid references public.profiles(id) on delete set null,
  occurrences integer not null default 1
);
create unique index uniq_ops_alert_open on public.ops_alerts (key) where status = 'open';
create index idx_ops_alerts_status on public.ops_alerts (status, last_seen_at desc);

-- Alert upsert RPC
create or replace function public.raise_ops_alert(
  p_key text, p_severity text, p_title text, p_detail jsonb
) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  insert into public.ops_alerts (key, severity, title, detail)
       values (p_key, p_severity, p_title, p_detail)
  on conflict (key) where status = 'open' do update
    set last_seen_at = now(),
        occurrences = ops_alerts.occurrences + 1,
        detail = excluded.detail,
        severity = excluded.severity
  returning id into v_id;
  return v_id;
end $$;
grant execute on function public.raise_ops_alert(text, text, text, jsonb) to service_role;

-- RLS
alter table public.app_logs enable row level security;
create policy app_logs_admin on public.app_logs for select using (public.is_admin());
alter table public.request_traces enable row level security;
create policy traces_admin on public.request_traces for select using (public.is_admin());

alter table public.feature_flags enable row level security;
create policy ff_read_authenticated on public.feature_flags for select to authenticated using (true);
create policy ff_admin_write on public.feature_flags for all using (public.is_admin()) with check (public.is_admin());

alter table public.health_probes enable row level security;
create policy probes_admin on public.health_probes for select using (public.is_admin());

alter table public.ops_alerts enable row level security;
create policy alerts_admin on public.ops_alerts for all using (public.is_admin()) with check (public.is_admin());
