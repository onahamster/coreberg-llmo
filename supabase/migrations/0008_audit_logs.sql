-- ============================================================================
-- 0008_audit_logs.sql
-- audit_logs / impersonation_sessions
-- ============================================================================

create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references public.profiles(id) on delete set null,
  actor_role text not null,
  actor_ip inet,
  actor_user_agent text,
  action text not null,
  resource_type text,
  resource_id text,
  target_user_id uuid references public.profiles(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index idx_audit_logs_actor
  on public.audit_logs(actor_id, created_at desc);

create index idx_audit_logs_target
  on public.audit_logs(target_user_id, created_at desc);

create index idx_audit_logs_action
  on public.audit_logs(action, created_at desc);

create index idx_audit_logs_resource
  on public.audit_logs(resource_type, resource_id);

create index idx_audit_logs_created
  on public.audit_logs(created_at desc);

-- ---------------------------------------------------------------------------
create table public.impersonation_sessions (
  id uuid primary key default gen_random_uuid(),
  admin_id uuid not null references public.profiles(id) on delete cascade,
  target_user_id uuid not null references public.profiles(id) on delete cascade,
  reason text not null,
  token_hash text not null unique,
  started_at timestamptz not null default now(),
  expires_at timestamptz not null,
  ended_at timestamptz,
  ended_by_admin boolean not null default false,

  constraint chk_imp_expires_future
    check (expires_at > started_at),
  constraint chk_imp_max_duration
    check (expires_at <= started_at + interval '30 minutes')
);

create index idx_impersonation_admin
  on public.impersonation_sessions(admin_id, started_at desc);

create index idx_impersonation_target
  on public.impersonation_sessions(target_user_id, started_at desc);

create index idx_impersonation_active
  on public.impersonation_sessions(token_hash)
  where ended_at is null;
