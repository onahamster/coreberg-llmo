-- ============================================================================
-- 0006_billing.sql
-- plans / subscriptions / invoices
-- ============================================================================

create table public.plans (
  id text primary key,
  name text not null,
  monthly_price_jpy int not null check (monthly_price_jpy >= 0),
  monthly_article_quota int not null check (monthly_article_quota > 0),
  features jsonb not null default '{}'::jsonb,
  stripe_price_id text unique,
  is_active boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 初期データ
insert into public.plans (id, name, monthly_price_jpy, monthly_article_quota, features, sort_order) values
  ('basic', 'Basic', 29800, 30,
   '{"citation_monitoring": true, "monthly_report": true, "wp_integration": true}'::jsonb, 1),
  ('pro', 'Pro', 148000, 30,
   '{"citation_monitoring": true, "monthly_report": true, "wp_integration": true, "external_authority": true, "zoom_support": true}'::jsonb, 2);

-- ---------------------------------------------------------------------------
create table public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  plan_id text not null references public.plans(id),
  stripe_subscription_id text unique,
  stripe_customer_id text,
  status text not null
    check (status in ('trialing','active','past_due','canceled','incomplete','incomplete_expired','unpaid')),
  current_period_start timestamptz,
  current_period_end timestamptz,
  cancel_at timestamptz,
  canceled_at timestamptz,
  trial_end timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_subscriptions_user
  on public.subscriptions(user_id);

create index idx_subscriptions_status
  on public.subscriptions(status)
  where status in ('active','trialing','past_due');

create index idx_subscriptions_stripe_customer
  on public.subscriptions(stripe_customer_id);

-- 1 ユーザー 1 アクティブサブスクリプションのみ
create unique index idx_subscriptions_user_active
  on public.subscriptions(user_id)
  where status in ('active','trialing','past_due');

-- ---------------------------------------------------------------------------
create table public.invoices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  subscription_id uuid references public.subscriptions(id) on delete set null,
  stripe_invoice_id text unique,
  amount_jpy int not null,
  status text not null
    check (status in ('draft','open','paid','uncollectible','void')),
  hosted_invoice_url text,
  pdf_url text,
  paid_at timestamptz,
  due_at timestamptz,
  created_at timestamptz not null default now()
);

create index idx_invoices_user
  on public.invoices(user_id, created_at desc);

create index idx_invoices_status
  on public.invoices(status)
  where status in ('open','uncollectible');
