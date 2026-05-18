-- ============================================================================
-- 0011_indexes.sql
-- 追加インデックス（ダッシュボード集計、モニタリング履歴、コスト分析向け複合インデックス）
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. モニタリング履歴の分析最適化インデックス
-- ---------------------------------------------------------------------------
-- 記事別・検索エンジン別の時系列引用結果をピンポイントで引く
create index if not exists idx_cm_article_engine_checked
  on public.citation_monitoring(article_id, engine, checked_at desc);

-- 引用成功例のみを時系列で高速集計する
create index if not exists idx_cm_article_cited_checked
  on public.citation_monitoring(article_id, checked_at desc)
  where cited = true;

-- ---------------------------------------------------------------------------
-- 2. キーワード・サブクエリ選定画面最適化インデックス
-- ---------------------------------------------------------------------------
-- 選択されたサブクエリをスコア順に並べて表示する
create index if not exists idx_subqueries_selected_score_desc
  on public.subqueries(generation_run_id, selected, citation_score desc)
  where selected = true;

-- ---------------------------------------------------------------------------
-- 3. 記事公開パイプライン・ダッシュボード最適化インデックス
-- ---------------------------------------------------------------------------
-- プロジェクト詳細画面でステータスごとの記事数を高速にカウント/リスト表示する
create index if not exists idx_articles_project_status_published
  on public.articles(project_id, status, published_at desc)
  where deleted_at is null;

-- WordPress 投稿 ID と記事の紐付け検索を高速化する
create index if not exists idx_articles_wp_post_id
  on public.articles(wp_post_id)
  where wp_post_id is not null and deleted_at is null;

-- ---------------------------------------------------------------------------
-- 4. コスト分析・監査（管理者機能）最適化インデックス
-- ---------------------------------------------------------------------------
-- 実行ラン内でのステップごとのAIコスト集計を高速化する
create index if not exists idx_ai_usage_run_step_cost
  on public.ai_usage(generation_run_id, step, cost_cents desc);

-- ユーザー別・月別の総消費トークン/コスト集計を高速化する
create index if not exists idx_ai_usage_user_created_cost
  on public.ai_usage(user_id, created_at desc, cost_cents);

-- ---------------------------------------------------------------------------
-- 5. サポートチケット管理（管理者・顧客共通）
-- ---------------------------------------------------------------------------
-- チケット管理画面でステータス・優先度順に並べる
create index if not exists idx_support_tickets_status_priority_created
  on public.support_tickets(status, priority, created_at desc);

-- ---------------------------------------------------------------------------
-- 6. 監査履歴・なりすまし記録（セキュリティ）
-- ---------------------------------------------------------------------------
-- 管理者による特定の操作アクションログを日付順に引く
create index if not exists idx_audit_logs_actor_action_created
  on public.audit_logs(actor_id, action, created_at desc);

-- 対象ユーザーに対する変更監査ログを高速検索する
create index if not exists idx_audit_logs_target_created
  on public.audit_logs(target_user_id, created_at desc);
