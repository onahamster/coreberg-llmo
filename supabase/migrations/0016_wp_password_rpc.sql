-- ============================================================================
-- 0016_wp_password_rpc.sql
-- WordPress Application Password の暗号化保存
-- ============================================================================

create or replace function public.admin_set_wp_password(
  p_project_id uuid,
  p_plaintext text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.projects
  set wp_app_password_encrypted = public.encrypt_secret(p_plaintext, 'wp:' || p_project_id::text)
  where id = p_project_id;
end;

$$;

create or replace function public.admin_get_wp_password(
  p_project_id uuid
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_enc bytea;
begin
  select wp_app_password_encrypted into v_enc from public.projects where id = p_project_id;
  if v_enc is null then return null; end if;
  return public.decrypt_secret(v_enc, 'wp:' || p_project_id::text);
end;

$$;

revoke execute on function public.admin_set_wp_password(uuid, text) from public;
revoke execute on function public.admin_get_wp_password(uuid) from public;
grant  execute on function public.admin_set_wp_password(uuid, text) to service_role;
grant  execute on function public.admin_get_wp_password(uuid) to service_role;
