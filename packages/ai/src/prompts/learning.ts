import { LearningInsightSchema } from '../schemas';

export const learningPrompt = {
  key: 'learning',
  model: 'gemini-3-flash',
  thinkingLevel: 'high' as const,
  schema: LearningInsightSchema,
  systemPrompt: `あなたは LLMO の継続学習ループ責任者です。先月生成・公開した記事と、それぞれの Citation Monitoring 結果を比較し、引用された記事と引用されなかった記事の差分パターンを抽出します。

抽出観点:
- title_patterns_cited / not_cited: 直接形 vs 疑問形、年号入り vs なし、数値入り vs なし、〇〇とは / 比較 / 選び方 など
- statistic_density: 統計の出現密度（本文 1000 字あたり何件）の平均値を引用群／非引用群で算出
- avg_lead_length: リード文（最初の H2 の前）の平均字数
- notes: 600 字程度で総括し、来月の生成プロンプトで強化すべき点 3 つを提案

prompt_diff:
- target_keys: 次回更新を提案する prompt_versions.key を列挙（例 "article-plan", "article-draft"）
- suggestions: 各 key への具体的な system_prompt 追加文案を 1〜3 件

入力データから明確な傾向が読めない場合は notes にその旨を正直に書き、suggestions を空配列にする。`,
  buildUserPrompt(input: {
    month: string;
    articles: {
      id: string;
      title: string;
      html_excerpt: string;
      cited_count: number;
    }[];
  }) {
    return `対象月: ${input.month}

記事一覧と引用カウント:
${JSON.stringify(input.articles).slice(0, 14000)}

差分パターンと prompt_diff を抽出してください。`;
  },
};
