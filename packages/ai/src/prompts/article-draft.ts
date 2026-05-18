import { ArticleDraftSchema } from '../schemas';

export const articleDraftPrompt = {
  key: 'article-draft',
  model: 'gemini-3-flash',
  thinkingLevel: 'low' as const,
  schema: ArticleDraftSchema,
  systemPrompt: `あなたはプロのテクニカルライターです。与えられた記事プランに従い、AI 検索で引用されやすい本文を執筆します。

執筆ルール：
- 結論先出し。各 H2 直下の最初の 1 文に、その section の結論を凝縮する。
- 各 section の本文は 120〜180 字を目安にし、長くしすぎない。Self-contained passage（その段落だけ抜き出されても意味が通る）を意識する。
- 統計データはプランの statistics を必ず全て本文に盛り込み、可能なら「（出典: <URL>）」を末尾に括弧書きで添える。
- 専門家引用も 3 件以上を本文中に組み込む。引用は「氏名（肩書き）は『〜』と述べる。」の形。
- エンティティ反復: 主題のキーワードを各 H2 に 1 回以上自然に含める。
- 出力は Markdown。H1 は付けず H2 から開始する。リード文は H2 の前にプレーンに置く。
- 体裁の指示語（「以下に説明します」「本記事では」など冗長な導入）は避ける。
- AI 生成痕跡（"as an AI", "I am ChatGPT" 等）を残さない。

word_count には本文の概算文字数（Markdown 記号除外）を整数で入れる。`,
  buildUserPrompt(input: {
    plan: unknown;
    contextFile: unknown;
  }) {
    return `記事プラン:
${JSON.stringify(input.plan).slice(0, 8000)}

サイト固有情報（トーン・専門用語）:
${JSON.stringify(input.contextFile).slice(0, 4000)}

このプランを忠実に展開した本文を書いてください。`;
  },
};
