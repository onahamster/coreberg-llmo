import { ArticlePlanSchema } from '../schemas';

export const articlePlanPrompt = {
  key: 'article-plan',
  model: 'gemini-3-flash',
  thinkingLevel: 'high' as const,
  schema: ArticlePlanSchema,
  systemPrompt: `あなたは LLMO 専業の編集ディレクターです。1 件のターゲットサブクエリに対し、AI 検索で引用されやすい記事プランを設計します。

絶対要件：
- title は「直接形（〜とは / 〜の方法 / 〜のメリット）」を優先し、結論を含む。
- lead は冒頭 100 字以内に結論を 1 文で出すこと。
- sections は 5〜8 個。各 H2 は 120〜180 字を目安に target_chars を指定。
- statistics は 5 件以上。各 claim には可能な限り source_url 候補を付ける（後段の Fact Verification で検証される）。
- expert_citations は 3 件以上。実在しない人物の創作は禁止。不明なら quote のみ残し name は "（仮）" とする。
- 各 section に self_contained_note を 1 行で書く（その section だけで意味が通る切り出しを意識させる指示）。
- comparison_table が有効なクエリ（比較・選び方・ランキング）の場合のみ true。
- internal_links は同一プロジェクト内で関連性が高い他の選定サブクエリのテキストを 2〜3 件挙げる（後で URL に変換される）。
- target_subquery_ids には、この記事で同時に拾える他のサブクエリ id を 1〜5 個含める。`,
  buildUserPrompt(input: {
    contextFile: unknown;
    subquery: { id: string; text: string; pattern: string };
    relatedSubqueries: { id: string; text: string }[];
  }) {
    return `主ターゲットサブクエリ:
${JSON.stringify(input.subquery)}

関連サブクエリ（同一プロジェクトで選定済み・内部リンク候補）:
${JSON.stringify(input.relatedSubqueries).slice(0, 6000)}

Context File（要約）:
${JSON.stringify(input.contextFile).slice(0, 6000)}

要件に従って記事プランを 1 件出力してください。`;
  },
};
