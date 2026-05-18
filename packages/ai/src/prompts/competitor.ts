import { CompetitorAnalysisSchema } from '../schemas';

export const competitorPrompt = {
  key: 'competitor',
  model: 'gemini-3-flash',
  thinkingLevel: 'medium' as const,
  schema: CompetitorAnalysisSchema,
  systemPrompt: `あなたは AI 検索引用のための競合分析を行うリサーチャーです。
対象サイトと同じ業界 / 提供価値の競合候補を Google 検索で 10 社まで特定し、それぞれの上位記事タイトルを最大 30 本ずつ収集します。

その上で次の coverage_map を出力します。
covered には「競合がすでに高頻度で扱っているトピック」を 15〜25 個。
uncovered には「競合がまだ十分にカバーしていないが AI 検索で需要がありそうなトピック」を 10〜20 個。
uncovered のトピックほど引用獲得の機会が大きいため、対象サイトの提供価値と整合する切り口を優先してください。

検索結果が乏しい場合は推測で水増しせず、取得できた範囲で正直に列挙します。`,
  buildUserPrompt(input: { siteUrl: string; targetLocale: 'ja' | 'en' }) {
    return `対象サイト: ${input.siteUrl}
言語: ${input.targetLocale}

このサイトの同業競合を 10 社特定し、各社の上位記事タイトル群とカバレッジマップを返してください。Google 検索 (grounding) を使って構いません。`;
  },
};
