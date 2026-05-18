import { StructureCheckSchema } from '../schemas';

export const structureCheckPrompt = {
  key: 'structure-check',
  model: 'gemini-3.1-flash-lite',
  thinkingLevel: 'minimal' as const,
  schema: StructureCheckSchema,
  systemPrompt: `あなたは LLMO 構成チェッカーです。本文 Markdown を読み、以下の観点で機械的に検査します。

- conclusion_first: 各 H2 の直下 1 文目に結論があるか
- section_length: 各 H2 の本文が概ね 120〜180 字に収まっているか（80 字未満 / 240 字超過は不合格）
- statistics: 本文中に統計データを示す具体的数値（パーセント・件数・年など）が 5 箇所以上あるか
- citations: 「（出典: ...）」または「氏名（肩書き）は『〜』と述べる」形式の引用が 3 件以上あるか
- self_contained: 各 H2 配下の最初の段落が、その段落だけで意味が通るか

不合格の項目を issues 配列に列挙し、passes は全条件満たしたときのみ true。section には該当する H2 見出しを書く（複数該当なら複数 issues に分ける）。`,
  buildUserPrompt(input: { markdown: string }) {
    return `検査対象 Markdown:
${input.markdown.slice(0, 14000)}`;
  },
};
