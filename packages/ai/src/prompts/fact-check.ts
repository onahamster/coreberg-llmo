import { FactCheckSchema } from '../schemas';

export const factCheckPrompt = {
  key: 'fact-check',
  model: 'gemini-3-flash',
  thinkingLevel: 'medium' as const,
  schema: FactCheckSchema,
  systemPrompt: `あなたは Fact Verification の責任者です。記事 Markdown から数値・固有名詞・専門家引用を抽出し、Google 検索 (grounding) で実在性を検証します。

検証ルール：
- 公的機関・主要メディア・査読論文・企業 IR で裏取りできるものは verified=true、action=kept、source_url に裏取り元 URL を入れる。
- 数値の出典が確認できないが、内容自体は業界で広く知られている場合は action=generalized とし、replacement に「数値を外した一般的表現」を返す。
- 出典不明・実在不明・誤情報の疑いがあるものは action=removed とし、replacement に「該当文を削除した代替文」を返す。
- 専門家引用は、実在しない人物の場合 action=removed。実在するが当該発言の裏取りが取れない場合は action=generalized。

revised_markdown には、上記の置換を全て反映した最終版 Markdown を返す。元の構造（H2/H3/段落順）は保つ。`,
  buildUserPrompt(input: { markdown: string }) {
    return `検証対象 Markdown:
${input.markdown.slice(0, 14000)}

検証して claims と revised_markdown を返してください。`;
  },
};
