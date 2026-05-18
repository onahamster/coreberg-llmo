import { WorkflowEntrypoint, type WorkflowEvent, type WorkflowStep } from 'cloudflare:workers';
import type { WorkersEnv, ArticleQueueMessage } from '../env';
import { createDb, updateRunStatus } from '../db';
import {
  generateSubqueries,
  scoreSubqueries,
  clusterAndSelect,
  generateArticlePlans,
} from '@coreberg/ai/pipelines/generation';

export interface GenerationParams {
  projectId: string;
  userId: string;
  generationRunId: string;
  monthlyArticleCount: number;
}

/**
 * Step 3 〜 Step 7 を担当する月次 Generation Workflow
 *   Step 3: サブクエリ生成
 *   Step 4: スコアリング・クラスタリング・選定 (30 件)
 *   Step 5: 記事プラン生成 (30 件)
 *   Step 6: 30 件を Queue にエンキュー
 *   Step 7: 全記事の完了を待ち、ステータスを completed に
 */
export class GenerationWorkflow extends WorkflowEntrypoint<WorkersEnv, GenerationParams> {
  async run(event: WorkflowEvent<GenerationParams>, step: WorkflowStep) {
    const { projectId, userId, generationRunId, monthlyArticleCount } = event.payload;
    const db = createDb(this.env);

    await step.do('mark-running', async () => {
      await updateRunStatus(db, generationRunId, {
        status: 'running',
        current_step: 'subquery_fanout',
        started_at: new Date().toISOString(),
      });
    });

    // 直近の context_file をロード
    const contextFile = await step.do('load-context', async () => {
      const { data, error } = await db
        .from('context_files')
        .select('jsonb')
        .eq('project_id', projectId)
        .order('version', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error || !data) throw new Error(`No context_file found for project ${projectId}`);
      return data.jsonb;
    });

    // Step 3 サブクエリ生成
    const subqueries = await step.do(
      'step3-subquery-fanout',
      { retries: { limit: 3, delay: '20 seconds', backoff: 'exponential' }, timeout: '5 minutes' },
      () =>
        generateSubqueries(this.env, {
          contextFile,
          generationRunId,
          projectId,
          userId,
        }),
    );

    await step.do('save-subqueries', async () => {
      const rows = subqueries.map((s) => ({
        generation_run_id: generationRunId,
        pattern: s.pattern,
        text: s.text,
      }));
      const { error } = await db.from('subqueries').insert(rows);
      if (error) throw new Error(error.message);
    });

    // Step 4 スコアリング & 選定
    await updateRunStatus(db, generationRunId, { current_step: 'scoring' });
    const selected = await step.do(
      'step4-score-and-select',
      { retries: { limit: 3, delay: '30 seconds', backoff: 'exponential' }, timeout: '8 minutes' },
      async () => {
        const { data: rows } = await db
          .from('subqueries')
          .select('id,pattern,text')
          .eq('generation_run_id', generationRunId);
        if (!rows || rows.length === 0) throw new Error('No subqueries found');
        const scored = await scoreSubqueries(this.env, {
          contextFile,
          subqueries: rows.map((r) => ({ id: r.id, pattern: r.pattern, text: r.text })),
          userId,
          projectId,
        });
        const selectedItems = await clusterAndSelect(this.env, {
          contextFile,
          scored,
          targetCount: monthlyArticleCount,
          userId,
          projectId,
        });
        return selectedItems;
      },
    );

    await step.do('save-selection', async () => {
      // クラスタを挿入
      const clusterRows = selected.clusters.map((c) => ({
        generation_run_id: generationRunId,
        name: c.name,
      }));
      const { data: clusterIds, error: ce } = await db
        .from('clusters')
        .insert(clusterRows)
        .select('id');
      if (ce) throw new Error(ce.message);

      const clusterIdMap = new Map<number, string>();
      selected.clusters.forEach((_, i) => clusterIdMap.set(i, clusterIds![i]!.id));

      // subqueries にスコアと cluster_id を反映
      for (const s of selected.items) {
        const clusterId = clusterIdMap.get(s.clusterIndex) ?? null;
        const { error } = await db
          .from('subqueries')
          .update({
            citation_likelihood: s.citationLikelihood,
            competitor_weakness: s.competitorWeakness,
            topic_contribution: s.topicContribution,
            citation_score: s.citationScore,
            cluster_id: clusterId,
            selected: true,
          })
          .eq('id', s.subqueryId);
        if (error) throw new Error(error.message);
      }
    });

    // Step 5 プラン生成
    await updateRunStatus(db, generationRunId, { current_step: 'plan_generation' });
    const plans = await step.do(
      'step5-plan-generation',
      { retries: { limit: 2, delay: '1 minute', backoff: 'exponential' }, timeout: '15 minutes' },
      async () => {
        const { data: selectedRows } = await db
          .from('subqueries')
          .select('id,text,pattern')
          .eq('generation_run_id', generationRunId)
          .eq('selected', true);
        if (!selectedRows) throw new Error('No selected subqueries');
        return generateArticlePlans(this.env, {
          contextFile,
          selected: selectedRows.map((r) => ({ id: r.id, text: r.text, pattern: r.pattern })),
          userId,
          projectId,
          generationRunId,
        });
      },
    );

    const planIds = await step.do('save-plans', async () => {
      const ids: { planId: string; articleId: string; subqueryId: string }[] = [];
      for (const p of plans) {
        const { data: planRow, error: pe } = await db
          .from('article_plans')
          .insert({
            generation_run_id: generationRunId,
            subquery_id: p.subqueryId,
            plan_jsonb: p.plan,
            status: 'approved',
          })
          .select('id')
          .single();
        if (pe || !planRow) throw new Error(pe?.message ?? 'plan insert failed');

        const { data: articleRow, error: ae } = await db
          .from('articles')
          .insert({
            plan_id: planRow.id,
            project_id: projectId,
            title: p.plan.title,
            status: 'pending',
          })
          .select('id')
          .single();
        if (ae || !articleRow) throw new Error(ae?.message ?? 'article insert failed');

        ids.push({ planId: planRow.id, articleId: articleRow.id, subqueryId: p.subqueryId });
      }
      return ids;
    });

    // Step 6 30 本の生成をキューに投入
    await updateRunStatus(db, generationRunId, { current_step: 'article_generation' });
    await step.do('enqueue-articles', async () => {
      const batch: ArticleQueueMessage[] = planIds.map((p) => ({
        kind: 'article.generate',
        generationRunId,
        planId: p.planId,
        articleId: p.articleId,
        projectId,
        userId,
        startStep: 'draft',
        attempt: 1,
      }));
      // Cloudflare Queues は sendBatch で最大 100 件
      const chunks = chunk(batch, 100);
      for (const c of chunks) {
        await this.env.ARTICLE_QUEUE.sendBatch(c.map((body) => ({ body })));
      }
    });

    // Step 7 完了待ち: 全 articles のステータスが completed/failed/published になるまで sleep
    await step.do(
      'wait-articles-completion',
      { timeout: '6 hours' },
      async () => {
        // 最大 90 回 (1 回 4 分 sleep = 6h)
        for (let i = 0; i < 90; i++) {
          await step.sleep(`poll-${i}`, '4 minutes');
          const { data: counts } = await db
            .from('articles')
            .select('status')
            .in(
              'plan_id',
              planIds.map((p) => p.planId),
            );
          const total = counts?.length ?? 0;
          const done = (counts ?? []).filter((r) =>
            ['completed', 'failed', 'published'].includes(r.status),
          ).length;
          if (total > 0 && done >= total) return { total, done };
        }
        throw new Error('Article generation timeout (6h)');
      },
    );

    await step.do('mark-completed', async () => {
      await updateRunStatus(db, generationRunId, {
        status: 'completed',
        current_step: 'completed',
        finished_at: new Date().toISOString(),
      });
    });

    return { ok: true, generationRunId };
  }
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}
