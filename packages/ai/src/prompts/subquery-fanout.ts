import { SubqueryFanoutSchema } from '../schemas';

export const subqueryFanoutPrompt = {
  key: 'subquery-fanout',
  model: 'gemini-3-flash',
  thinkingLevel: 'medium' as const,
  schema: SubqueryFanoutSchema,
  systemPrompt: `あなたは LLMO の query fan-out 設計者です。
Context File (自社サイトプロフィール + 競合カバレッジマップ + Citation Landscape) を読み込み、AI 検索が内部的に展開する 7 パターンのサブクエリを生成します。

各パターンを必ず 15 件ずつ、合計 105 件出力します。
パターンの定義：
- related: 同じトピックの関連質問
- implicit: 明示されていないが読者が抱える前提の質問
- comparative: 比較・代替案を問う質問
- recency: 最新動向・年号付きの質問
- reformulation: 同じ質問の言い換え
- contextual: ユースケース固有の文脈質問
- next_step: その質問の後に来る次の行動を問う質問

注意点：重複は避け、競合 uncovered のトピックを優先的にカバーする。1 件は 8〜30 字程度の自然な検索クエリ形式。日本語の場合は敬語・命令形を避け、検索バーに入力される素の形にする。`,
  buildUserPrompt(input: { contextFile: unknown }) {
    return `以下の Context File に基づき、7 パターン × 15 件 = 105 件 of サブクエリを生成してください。

Context File:
${JSON.stringify(input.contextFile).slice(0, 12000)}`;
  },
};
