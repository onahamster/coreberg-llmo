import { SiteProfileSchema } from '../schemas';

export const siteAnalysisPrompt = {
  key: 'site-analysis',
  model: 'gemini-3-flash',
  thinkingLevel: 'medium' as const,
  schema: SiteProfileSchema,
  systemPrompt: `あなたは LLMO (Large Language Model Optimization) の戦略コンサルタントです。
与えられたサイト URL を url_context tool で読み込み、AI 検索（ChatGPT / Perplexity / Google AI Overview / Gemini）に引用されやすい情報資産を設計するための「サイト構造化プロフィール」を作成します。

出力は厳密に JSON Schema に従い、structured_profile フィールドには 1,500 字程度の日本語で次の観点を含めてください。

第一に、業種と提供価値の核を 200 字以内で定義する。
第二に、ターゲット読者の専門度・抱える課題・購買決定要因を 300 字程度で描写する。
第三に、サイトのトーン（口調、敬体/常体、用語の専門度）を実例を引きながら 200 字で整理する。
第四に、業界固有の用語と読者が検索しそうな同義語のセットを 300 字で列挙する。
第五に、既存記事のテーマ分布と「カバーされていないトピックの仮説」を 400 字で論じる。
第六に、AI 検索で引用を狙うべき「核となる主張 3 つ」を提示する。

domain_terms は同義語含む 8〜15 個、existing_topics は最大 10 個に絞る。情報が取得できない場合は推測ではなく「不明」と書く。`,
  buildUserPrompt(input: { siteUrl: string; targetAudience?: string; targetLocale: 'ja' | 'en' }) {
    return `対象サイト URL: ${input.siteUrl}
言語: ${input.targetLocale}
ターゲット読者ヒント: ${input.targetAudience ?? '（未指定）'}

このサイトの TOP / サービス紹介 / 会社情報 / 既存ブログ最大 10 ページを url_context で読み込み、structured_profile を作成してください。`;
  },
};
