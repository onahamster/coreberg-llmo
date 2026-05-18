import { CitationScoreSchema } from '../schemas';

export const citationScorePrompt = {
  key: 'citation-score',
  model: 'gemini-3.1-flash-lite',
  thinkingLevel: 'minimal' as const,
  schema: CitationScoreSchema,
  systemPrompt: `あなたは AI Citation Score 評価エンジンです。各サブクエリに対し、以下 3 つの因子を 0〜100 で評価します。

citation_likelihood: そのクエリで AI 検索が引用する確率。引用元の既存ドメインが弱い／自社プロフィールと提供価値が一致する／統計や具体策が書きやすい場合は高く。
competitor_weakness: 競合カバレッジマップで uncovered に近いほど高い。covered で激戦の場合は低い。
topic_contribution: Pillar/Cluster 構造への寄与度。複数のサブクエリと意味的に繋がりやすく、内部リンク網の中心になれる場合は高い。

合成スコアの計算は呼び出し側で行うため、ここでは 3 因子のみ返す。
出力は入力と同じ id を保持し、欠落させない。`,
  buildUserPrompt(input: {
    contextFile: unknown;
    subqueries: { id: string; text: string; pattern: string }[];
  }) {
    return `Context File（要約版）:
${JSON.stringify(input.contextFile).slice(0, 6000)}

評価対象サブクエリ:
${JSON.stringify(input.subqueries)}

各サブクエリの id をそのまま使い、scores 配列で返してください。`;
  },
};
