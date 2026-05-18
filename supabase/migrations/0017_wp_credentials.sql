-- ============================================================================
-- 0017_wp_credentials.sql
-- WordPress Application Password を pgsodium で暗号化保管する RPC
-- ============================================================================

-- Add encrypted column on projects (binary, nullable)
alter table public.projects
  add column if not exists wp_app_password_encrypted bytea,
  add column if not exists wp_username text;

-- Set Application Password (service_role only callable through RPC wrapper)
create or replace function public.project_set_wp_password(
  p_project_id uuid,
  p_username text,
  p_password text
) returns void
language plpgsql
security definer
set search_path = public, pgsodium
as $$
declare
  v_key_id uuid;
begin
  -- Use pgsodium key fetched by name (created via migration 0001)
  select id into v_key_id from pgsodium.key
   where name = 'coreberg_default' limit 1;
  if v_key_id is null then
    raise exception 'pgsodium key not found';
  end if;

  update public.projects
     set wp_username = p_username,
         wp_app_password_encrypted = pgsodium.crypto_aead_det_encrypt(
           convert_to(p_password, 'utf8'),
           convert_to(p_project_id::text, 'utf8'),
           v_key_id
         ),
         updated_at = now()
   where id = p_project_id;
end;

$$;

-- Internal getter — must only be called via service_role from Workers
create or replace function public.project_get_wp_password(
  p_project_id uuid
) returns table(username text, password text)
language plpgsql
security definer
set search_path = public, pgsodium
as $$
declare
  v_key_id uuid;
  v_cipher bytea;
  v_user text;
begin
  select id into v_key_id from pgsodium.key
   where name = 'coreberg_default' limit 1;

  select wp_username, wp_app_password_encrypted
    into v_user, v_cipher
    from public.projects
   where id = p_project_id;

  if v_cipher is null then
    return;
  end if;

  return query select
    v_user,
    convert_from(
      pgsodium.crypto_aead_det_decrypt(
        v_cipher,
        convert_to(p_project_id::text, 'utf8'),
        v_key_id
      ),
      'utf8'
    );
end;

$$;

revoke all on function public.project_set_wp_password(uuid, text, text) from public;
revoke all on function public.project_get_wp_password(uuid) from public;
grant execute on function public.project_set_wp_password(uuid, text, text) to service_role;
grant execute on function public.project_get_wp_password(uuid) to service_role;
