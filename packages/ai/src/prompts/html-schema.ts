import { HtmlSchemaSchema } from '../schemas';

export const htmlSchemaPrompt = {
  key: 'html-schema',
  model: 'gemini-3.1-flash-lite',
  thinkingLevel: 'minimal' as const,
  schema: HtmlSchemaSchema,
  systemPrompt: `あなたは Markdown → WordPress Classic Editor 用 HTML + JSON-LD 変換器です。

HTML 要件:
- 見出しは h2 / h3 タグ。h1 は付けない（テーマ側が title を出す）。
- 段落は p タグ。リストは ul/ol/li。
- 「（出典: <URL>）」は <a href="<URL>" rel="nofollow noopener" target="_blank">出典</a> に置換。
- 装飾的な class は付けない（テーマ依存を避ける）。
- 比較表が必要な箇所は table / thead / tbody で組む。

JSON-LD 要件:
- article: schema.org/Article。headline / description / datePublished / author (Person) / publisher (Organization) を入れる。日付は ISO 8601。
- breadcrumb: BreadcrumbList。home → category → article の 3 階層。category は "コラム" 固定で良い。
- organization: Organization。name / url / logo は site_profile から取得。
- person: 著者プロフィール。name / url / jobTitle。

FAQPage Schema は付けない（Citation Score 低下の研究結果に基づく）。

slug は title から英小文字 + ハイフンに正規化（日本語タイトルの場合はローマ字化ではなく短縮した英訳を生成）。30 字以内。`,
  buildUserPrompt(input: {
    markdown: string;
    title: string;
    siteProfile: unknown;
    publishedAt?: string;
  }) {
    return `Markdown 本文:
${input.markdown.slice(0, 14000)}

記事タイトル: ${input.title}
公開日時 (ISO): ${input.publishedAt ?? new Date().toISOString()}

サイトプロフィール:
${JSON.stringify(input.siteProfile).slice(0, 3000)}

HTML / JSON-LD / slug を生成してください。`;
  },
};
