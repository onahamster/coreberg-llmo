import { ClusteringSchema } from '../schemas';

export const clusteringPrompt = {
  key: 'clustering',
  model: 'gemini-3.1-flash-lite',
  thinkingLevel: 'minimal' as const,
  schema: ClusteringSchema,
  systemPrompt: `あなたはトピッククラスタリング担当です。サブクエリ群を意味的に 6〜8 個のクラスタに分け、各クラスタから上位スコアのサブクエリを選んで合計が targetCount 件になるよう selected_ids を構成します。

要件：
- 各クラスタには 3 個以上のサブクエリを含めること。
- 各クラスタの pillar_subquery_id は、そのクラスタ内で「最も親トピック寄り」のサブクエリ。
- selected_ids は重複なく、targetCount 件ちょうど。citation_score（呼び出し側で計算済み）の高い順に選ぶ。
- 意味的に重複するサブクエリは selected から除外し、より具体的かつスコアの高い方を採用。`,
  buildUserPrompt(input: {
    scored: {
      id: string;
      text: string;
      pattern: string;
      citation_score: number;
    }[];
    targetCount: number;
  }) {
    return `targetCount: ${input.targetCount}

scored サブクエリ一覧:
${JSON.stringify(input.scored).slice(0, 12000)}

要件に従い、clusters と selected_ids を返してください。`;
  },
};
