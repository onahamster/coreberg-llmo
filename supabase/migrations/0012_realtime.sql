-- ============================================================================
-- 0012_realtime.sql
-- Supabase Realtime 同期設定
-- ============================================================================

begin;
  -- supabase_realtime publication の存在を確認、なければ作成
  do $$
  begin
    if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
      create publication supabase_realtime;
    end if;
  end;
  $$;

  -- リアルタイム更新を購読可能にするテーブルを publication に追加
  -- 1. 進捗バー更新用の月次生成ステータス
  alter publication supabase_realtime add table public.generation_runs;

  -- 2. 記事個別の並列生成進行状態 (drafting, checking, fact_checking, etc.)
  alter publication supabase_realtime add table public.articles;

  -- 3. アカウント情報・TOTP 認証状態
  alter publication supabase_realtime add table public.profiles;

  -- 4. リアルタイム・カスタマーサポートのチケットとメッセージ
  alter publication supabase_realtime add table public.support_tickets;
  alter publication supabase_realtime add table public.support_messages;
commit;

comment on publication supabase_realtime is
  'Supabase Realtime 用のパブリケーション設定。顧客用・管理用ダッシュボードのリアルタイム同期を有効化';
