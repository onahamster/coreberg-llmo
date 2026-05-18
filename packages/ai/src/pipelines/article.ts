import type { WorkersEnv, ArticleQueueMessage } from '@coreberg/workers-shared';
import { createDb, recordAiUsage } from '@coreberg/workers-shared';
import { configFromEnv, generateContent, generateImage } from '../gemini';
import {
  articleDraftPrompt,
  structureCheckPrompt,
  factCheckPrompt,
  htmlSchemaPrompt,
  imagePrompt,
} from '../prompts';
import { calcCostCents, type ModelId } from '../pricing';

/**
 * Step 6.1 本文ドラフト
 * - article_plans から plan を取得
 * - context_file から site_profile を取得
 * - 生成した Markdown を articles.html に一時保存（後段で HTML に変換）
 */
export async function runArticleDraft(env: WorkersEnv, msg: ArticleQueueMessage): Promise<void> {
  const db = createDb(env);
  const cfg = configFromEnv(env);

  const { data: plan } = await db
    .from('article_plans')
    .select('id,plan_jsonb,subquery_id')
    .eq('id', msg.planId)
    .single();
  if (!plan) throw new Error(`Plan not found: ${msg.planId}`);

  const { data: ctx } = await db
    .from('context_files')
    .select('jsonb')
    .eq('project_id', msg.projectId)
    .order('version', { ascending: false })
    .limit(1)
    .single();

  const t0 = Date.now();
  const res = await generateContent<{ title: string; body_markdown: string; word_count?: number }>(
    cfg,
    {
      model: articleDraftPrompt.model,
      systemInstruction: articleDraftPrompt.systemPrompt,
      thinkingLevel: articleDraftPrompt.thinkingLevel,
      responseMimeType: 'application/json',
      responseSchema: { ...((articleDraftPrompt as unknown as { schema: object }).schema ?? {}) },
      contents: [
        {
          role: 'user',
          parts: [
            {
              text: articleDraftPrompt.buildUserPrompt({
                plan: plan.plan_jsonb,
                contextFile: ctx?.jsonb ?? {},
              }),
            },
          ],
        },
      ],
      maxOutputTokens: 16000,
    },
  );

  await recordAiUsage(db, {
    user_id: msg.userId,
    project_id: msg.projectId,
    generation_run_id: msg.generationRunId,
    article_id: msg.articleId,
    step: 'article_draft',
    model: articleDraftPrompt.model,
    input_tokens: res.usage.inputTokens,
    output_tokens: res.usage.outputTokens,
    thinking_tokens: res.usage.thinkingTokens,
    cost_cents: calcCostCents(articleDraftPrompt.model as ModelId, res.usage),
    latency_ms: Date.now() - t0,
  });

  const draft = res.json ?? { title: '', body_markdown: '' };
  await db
    .from('articles')
    .update({
      title: draft.title || msg.articleId,
      html: draft.body_markdown, // 一時的に markdown を入れる。Step 6.4 で HTML へ
      word_count: draft.word_count ?? null,
    })
    .eq('id', msg.articleId);
}

/**
 * Step 6.2 構成チェック → 不合格箇所は再生成（簡略実装: passes でない場合は同じ markdown を返す）
 */
export async function runStructureCheck(env: WorkersEnv, msg: ArticleQueueMessage): Promise<void> {
  const db = createDb(env);
  const cfg = configFromEnv(env);

  const { data: article } = await db
    .from('articles')
    .select('html')
    .eq('id', msg.articleId)
    .single();
  if (!article?.html) throw new Error('Draft missing');

  const t0 = Date.now();
  const res = await generateContent<{ passes: boolean; issues: unknown[] }>(cfg, {
    model: structureCheckPrompt.model,
    systemInstruction: structureCheckPrompt.systemPrompt,
    thinkingLevel: structureCheckPrompt.thinkingLevel,
    responseMimeType: 'application/json',
    responseSchema: structureCheckPrompt.schema,
    contents: [
      {
        role: 'user',
        parts: [{ text: structureCheckPrompt.buildUserPrompt({ markdown: article.html }) }],
      },
    ],
  });

  await recordAiUsage(db, {
    user_id: msg.userId,
    project_id: msg.projectId,
    generation_run_id: msg.generationRunId,
    article_id: msg.articleId,
    step: 'structure_check',
    model: structureCheckPrompt.model,
    input_tokens: res.usage.inputTokens,
    output_tokens: res.usage.outputTokens,
    cost_cents: calcCostCents(structureCheckPrompt.model as ModelId, res.usage),
    latency_ms: Date.now() - t0,
  });

  // 部分書き戻しの詳細実装は v1.1 で対応。ここでは結果を記録するのみ
  if (res.json && !res.json.passes) {
    console.warn('structure check has issues', msg.articleId, res.json.issues);
  }
}

/**
 * Step 6.3 Fact Verification
 */
export async function runFactVerification(
  env: WorkersEnv,
  msg: ArticleQueueMessage,
): Promise<void> {
  const db = createDb(env);
  const cfg = configFromEnv(env);

  const { data: article } = await db
    .from('articles')
    .select('html')
    .eq('id', msg.articleId)
    .single();
  if (!article?.html) throw new Error('Draft missing for fact check');

  const t0 = Date.now();
  const res = await generateContent<{
    claims: { claim: string; verified: boolean; source_url?: string; action: string; replacement?: string }[];
    revised_markdown: string;
  }>(cfg, {
    model: factCheckPrompt.model,
    systemInstruction: factCheckPrompt.systemPrompt,
    thinkingLevel: factCheckPrompt.thinkingLevel,
    responseMimeType: 'application/json',
    responseSchema: factCheckPrompt.schema,
    tools: [{ googleSearch: {} }],
    contents: [
      {
        role: 'user',
        parts: [{ text: factCheckPrompt.buildUserPrompt({ markdown: article.html }) }],
      },
    ],
    maxOutputTokens: 16000,
  });

  await recordAiUsage(db, {
    user_id: msg.userId,
    project_id: msg.projectId,
    generation_run_id: msg.generationRunId,
    article_id: msg.articleId,
    step: 'fact_check',
    model: factCheckPrompt.model,
    input_tokens: res.usage.inputTokens,
    output_tokens: res.usage.outputTokens,
    thinking_tokens: res.usage.thinkingTokens,
    cost_cents: calcCostCents(factCheckPrompt.model as ModelId, res.usage),
    latency_ms: Date.now() - t0,
  });

  if (res.json) {
    // fact_checks に保存
    const rows = res.json.claims.map((c) => ({
      article_id: msg.articleId,
      claim: c.claim,
      verified: c.verified,
      source_url: c.source_url ?? null,
      action_taken: c.action as 'kept' | 'generalized' | 'removed',
    }));
    if (rows.length > 0) {
      await db.from('fact_checks').insert(rows);
    }
    if (res.json.revised_markdown) {
      await db
        .from('articles')
        .update({ html: res.json.revised_markdown })
        .eq('id', msg.articleId);
    }
  }
}

/**
 * Step 6.4 HTML + JSON-LD 変換
 */
export async function runHtmlSchema(env: WorkersEnv, msg: ArticleQueueMessage): Promise<void> {
  const db = createDb(env);
  const cfg = configFromEnv(env);

  const { data: article } = await db
    .from('articles')
    .select('title,html')
    .eq('id', msg.articleId)
    .single();
  if (!article?.html) throw new Error('Markdown missing');

  const { data: project } = await db
    .from('projects')
    .select('site_profile_jsonb,site_url')
    .eq('id', msg.projectId)
    .single();

  const t0 = Date.now();
  const res = await generateContent<{ html: string; json_ld: object; slug: string }>(cfg, {
    model: htmlSchemaPrompt.model,
    systemInstruction: htmlSchemaPrompt.systemPrompt,
    thinkingLevel: htmlSchemaPrompt.thinkingLevel,
    responseMimeType: 'application/json',
    responseSchema: htmlSchemaPrompt.schema,
    contents: [
      {
        role: 'user',
        parts: [
          {
            text: htmlSchemaPrompt.buildUserPrompt({
              markdown: article.html,
              title: article.title,
              siteProfile: project?.site_profile_jsonb ?? {},
            }),
          },
        ],
      },
    ],
    maxOutputTokens: 16000,
  });

  await recordAiUsage(db, {
    user_id: msg.userId,
    project_id: msg.projectId,
    generation_run_id: msg.generationRunId,
    article_id: msg.articleId,
    step: 'html_schema',
    model: htmlSchemaPrompt.model,
    input_tokens: res.usage.inputTokens,
    output_tokens: res.usage.outputTokens,
    cost_cents: calcCostCents(htmlSchemaPrompt.model as ModelId, res.usage),
    latency_ms: Date.now() - t0,
  });

  if (res.json) {
    await db
      .from('articles')
      .update({
        html: res.json.html,
        schema_jsonb: res.json.json_ld,
        slug: res.json.slug,
      })
      .eq('id', msg.articleId);
  }
}

/**
 * Step 6.5 アイキャッチ生成
 */
export async function runImageGeneration(
  env: WorkersEnv,
  msg: ArticleQueueMessage,
): Promise<void> {
  const db = createDb(env);
  const cfg = configFromEnv(env);

  const { data: article } = await db
    .from('articles')
    .select('title')
    .eq('id', msg.articleId)
    .single();
  const { data: project } = await db
    .from('projects')
    .select('site_profile_jsonb')
    .eq('id', msg.projectId)
    .single();

  const profile = (project?.site_profile_jsonb ?? {}) as {
    industry?: string;
    tone?: string;
  };

  const { imagePrompt: prompt, alt } = imagePrompt.buildImagePrompt({
    title: article?.title ?? '',
    industry: profile.industry ?? 'business',
    tone: profile.tone ?? 'editorial',
  });

  const t0 = Date.now();
  try {
    const result = await generateImage(cfg, { prompt, aspectRatio: '16:9' });

    // Supabase Storage にアップロード
    const filename = `articles/${msg.articleId}.${mimeToExt(result.mimeType)}`;
    const bytes = Uint8Array.from(atob(result.base64), (c) => c.charCodeAt(0));

    const { error } = await db.storage
      .from('article-images')
      .upload(filename, bytes, { contentType: result.mimeType, upsert: true });
    if (error) throw new Error(`Storage upload failed: ${error.message}`);

    const { data: pub } = db.storage.from('article-images').getPublicUrl(filename);

    await db
      .from('articles')
      .update({
        image_url: pub.publicUrl,
        image_alt: alt,
      })
      .eq('id', msg.articleId);

    await recordAiUsage(db, {
      user_id: msg.userId,
      project_id: msg.projectId,
      generation_run_id: msg.generationRunId,
      article_id: msg.articleId,
      step: 'image',
      model: 'gemini-3.1-flash-image',
      input_tokens: 0,
      output_tokens: 0,
      image_count: 1,
      cost_cents: calcCostCents('gemini-3.1-flash-image' as ModelId, { images: 1 }),
      latency_ms: Date.now() - t0,
    });
  } catch (e) {
    // 画像生成失敗は致命的ではないので、ログだけ残して継続
    console.error('image generation failed', msg.articleId, (e as Error).message);
  }
}

function mimeToExt(mime: string): string {
  if (mime.includes('png')) return 'png';
  if (mime.includes('webp')) return 'webp';
  if (mime.includes('jpeg') || mime.includes('jpg')) return 'jpg';
  return 'png';
}
