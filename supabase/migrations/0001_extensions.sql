-- ============================================================================
-- 0001_extensions.sql
-- 必須拡張機能の有効化
-- ============================================================================

-- UUID 生成（gen_random_uuid）
create extension if not exists "pgcrypto" with schema public;

-- 暗号化（TOTP secret, WP app password など）
create extension if not exists "pgsodium";

-- 時系列パーティション自動管理（citation_monitoring 用）
create extension if not exists "pg_partman" with schema partman cascade;

-- 文字列類似検索（管理画面 of ユーザー検索用）
create extension if not exists "pg_trgm" with schema public;

-- HTTP リクエスト（DB から外部 API を叩く用、保険）
create extension if not exists "http" with schema public;

-- JWT クレーム解析を簡潔に書くためのヘルパー
create or replace function public.current_role_claim()
returns text
language sql
stable
as $$
  select coalesce(
    nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'user_role',
    'anon'
  );
$$;

comment on function public.current_role_claim() is
  'JWT クレーム内の user_role を返す。RLS で auth.jwt() ->> ''user_role'' の代替として使用';
