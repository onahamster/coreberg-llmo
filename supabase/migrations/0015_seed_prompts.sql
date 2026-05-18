-- ============================================================================
-- 0015_seed_prompts.sql
-- 0002_profiles_and_roles 〜 0013 完了後に実行。
-- prompt_versions の "__PENDING__" を本物のプロンプトに置き換える。
-- 本体テキストが長いため、ここでは「TS 側から RPC 経由で投入」する設計に切り替え、
-- DB 側ではプロンプトを一意に更新できる upsert ヘルパーだけ用意する。
-- ============================================================================

create or replace function public.admin_upsert_prompt(
  p_key text,
  p_version int,
  p_system_prompt text,
  p_user_template text,
  p_schema_jsonb jsonb,
  p_model text,
  p_thinking_level text,
  p_notes text,
  p_actor uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  insert into public.prompt_versions
    (key, version, system_prompt, user_template, schema_jsonb, model, thinking_level, notes, created_by, is_active)
  values
    (p_key, p_version, p_system_prompt, p_user_template, p_schema_jsonb, p_model, p_thinking_level, p_notes, p_actor, false)
  on conflict (key, version) do update
    set system_prompt = excluded.system_prompt,
        user_template = excluded.user_template,
        schema_jsonb = excluded.schema_jsonb,
        model = excluded.model,
        thinking_level = excluded.thinking_level,
        notes = excluded.notes
  returning id into v_id;

  return v_id;
end;

$$;

revoke execute on function public.admin_upsert_prompt(text,int,text,text,jsonb,text,text,text,uuid) from public;
grant  execute on function public.admin_upsert_prompt(text,int,text,text,jsonb,text,text,text,uuid) to service_role;

-- ---------------------------------------------------------------------------
-- 指定 key の最新版を有効化（他のバージョンは無効化）
-- ---------------------------------------------------------------------------
create or replace function public.admin_activate_prompt(
  p_key text,
  p_version int
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.prompt_versions set is_active = false where key = p_key;
  update public.prompt_versions set is_active = true  where key = p_key and version = p_version;
end;

$$;

revoke execute on function public.admin_activate_prompt(text,int) from public;
grant  execute on function public.admin_activate_prompt(text,int) to service_role;
