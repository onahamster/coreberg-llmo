-- ============================================================================
-- 0002_profiles_and_roles.sql
-- profiles / role_history / auth.users との同期トリガー
-- ============================================================================

-- ---------------------------------------------------------------------------
-- profiles: auth.users と 1:1 で対応するユーザープロフィール
-- ---------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  display_name text,
  avatar_url text,
  role text not null default 'customer'
    check (role in ('customer','support','admin','super_admin')),
  locale text not null default 'ja'
    check (locale in ('ja','en')),
  timezone text not null default 'Asia/Tokyo',
  -- TOTP (admin 専用)
  totp_secret_encrypted bytea,
  totp_enabled boolean not null default false,
  -- ログイン履歴
  last_login_at timestamptz,
  last_login_ip inet,
  -- メタ
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create unique index idx_profiles_email_unique
  on public.profiles(lower(email))
  where deleted_at is null;

create index idx_profiles_role
  on public.profiles(role)
  where deleted_at is null;

create index idx_profiles_email_trgm
  on public.profiles using gin (email gin_trgm_ops);

comment on table public.profiles is
  'ユーザープロフィール。auth.users と 1:1。role により顧客/管理者を区別';
comment on column public.profiles.totp_secret_encrypted is
  'pgsodium で暗号化された TOTP secret (admin のみ使用)';

-- ---------------------------------------------------------------------------
-- role_history: role 変更の履歴（監査要件）
-- ---------------------------------------------------------------------------
create table public.role_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  old_role text not null,
  new_role text not null,
  changed_by uuid references public.profiles(id),
  reason text,
  created_at timestamptz not null default now()
);

create index idx_role_history_user
  on public.role_history(user_id, created_at desc);

-- ---------------------------------------------------------------------------
-- auth.users → public.profiles の自動同期
-- 新規サインアップ時に profile を upsert する
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_display_name text;
  v_avatar_url text;
  v_email text;
begin
  -- Google OAuth の場合 raw_user_meta_data に full_name / avatar_url が入る
  v_email := coalesce(new.email, '');
  v_display_name := coalesce(
    new.raw_user_meta_data ->> 'full_name',
    new.raw_user_meta_data ->> 'name',
    split_part(v_email, '@', 1)
  );
  v_avatar_url := new.raw_user_meta_data ->> 'avatar_url';

  insert into public.profiles (id, email, display_name, avatar_url, role)
  values (new.id, v_email, v_display_name, v_avatar_url, 'customer')
  on conflict (id) do update
    set email = excluded.email,
        display_name = coalesce(public.profiles.display_name, excluded.display_name),
        avatar_url = coalesce(excluded.avatar_url, public.profiles.avatar_url),
        updated_at = now();

  -- JWT に user_role を含めるため auth.users.raw_app_meta_data に書き込む
  update auth.users
  set raw_app_meta_data =
    coalesce(raw_app_meta_data, '{}'::jsonb) || jsonb_build_object('user_role', 'customer')
  where id = new.id;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- profiles.role 変更時に role_history へ記録 & JWT メタデータ同期
-- ---------------------------------------------------------------------------
create or replace function public.sync_role_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.role is distinct from old.role then
    insert into public.role_history (user_id, old_role, new_role, changed_by, reason)
    values (
      new.id,
      old.role,
      new.role,
      nullif(current_setting('app.actor_id', true), '')::uuid,
      nullif(current_setting('app.role_change_reason', true), '')
    );

    update auth.users
    set raw_app_meta_data =
      coalesce(raw_app_meta_data, '{}'::jsonb) || jsonb_build_object('user_role', new.role)
    where id = new.id;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_profiles_role_change on public.profiles;
create trigger trg_profiles_role_change
  after update of role on public.profiles
  for each row execute function public.sync_role_change();
