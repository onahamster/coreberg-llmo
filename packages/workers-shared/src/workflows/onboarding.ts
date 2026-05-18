import { WorkflowEntrypoint, type WorkflowEvent, type WorkflowStep } from 'cloudflare:workers';
import type { WorkersEnv } from '../env';
import { createDb } from '../db';
import {
  runSiteAnalysis,
  runCompetitorAnalysis,
  runCitationLandscape,
  runAuditStep0,
} from '@coreberg/ai/pipelines/onboarding';

export interface OnboardingParams {
  projectId: string;
  userId: string;
  siteUrl: string;
  targetAudience?: string;
  targetLocale: 'ja' | 'en';
}

/**
 * Step 0 〜 Step 2 を直列に実行する Workflow
 * - Step 0: 前提監査 (robots / llms.txt / Schema / Core Web Vitals)
 * - Step 2A 自社サイト解析
 * - Step 2B 競合発見・分析
 * - Step 2C Citation Landscape
 * - 最後に context_files を保存
 */
export class OnboardingWorkflow extends WorkflowEntrypoint<WorkersEnv, OnboardingParams> {
  async run(event: WorkflowEvent<OnboardingParams>, step: WorkflowStep) {
    const { projectId, userId, siteUrl, targetAudience, targetLocale } = event.payload;
    const db = createDb(this.env);

    await step.do('mark-running', async () => {
      const { error } = await db
        .from('projects')
        .update({ status: 'active' })
        .eq('id', projectId);
      if (error) throw new Error(error.message);
    });

    const audit = await step.do(
      'step0-audit',
      { retries: { limit: 3, delay: '30 seconds', backoff: 'exponential' } },
      async () => {
        return runAuditStep0(this.env, { siteUrl, projectId, userId });
      },
    );

    await step.do('save-audit', async () => {
      const { error } = await db
        .from('projects')
        .update({ audit_jsonb: audit })
        .eq('id', projectId);
      if (error) throw new Error(error.message);
    });

    // 2A / 2B / 2C を並列実行
    const [siteProfile, competitor, landscape] = await Promise.all([
      step.do(
        'step2a-site-analysis',
        { retries: { limit: 3, delay: '20 seconds', backoff: 'exponential' }, timeout: '5 minutes' },
        () => runSiteAnalysis(this.env, { siteUrl, userId, projectId }),
      ),
      step.do(
        'step2b-competitor',
        { retries: { limit: 3, delay: '20 seconds', backoff: 'exponential' }, timeout: '5 minutes' },
        () => runCompetitorAnalysis(this.env, { siteUrl, userId, projectId, targetLocale }),
      ),
      step.do(
        'step2c-citation-landscape',
        { retries: { limit: 3, delay: '20 seconds', backoff: 'exponential' }, timeout: '5 minutes' },
        () =>
          runCitationLandscape(this.env, {
            siteUrl,
            userId,
            projectId,
            targetLocale,
            targetAudience,
          }),
      ),
    ]);

    await step.do('save-site-profile', async () => {
      const { error } = await db
        .from('projects')
        .update({ site_profile_jsonb: siteProfile })
        .eq('id', projectId);
      if (error) throw new Error(error.message);
    });

    await step.do('save-context-file', async () => {
      const merged = {
        version: 1,
        generated_at: new Date().toISOString(),
        site_profile: siteProfile,
        competitor,
        citation_landscape: landscape,
      };
      const { error } = await db.from('context_files').insert({
        project_id: projectId,
        version: 1,
        jsonb: merged,
      });
      if (error) throw new Error(error.message);
    });

    return { ok: true, projectId };
  }
}
