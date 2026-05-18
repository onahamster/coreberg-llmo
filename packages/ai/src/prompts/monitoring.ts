import { MonitoringJudgeSchema } from '../schemas';

export const monitoringPrompt = {
  key: 'monitoring',
  model: 'gemini-3.1-flash-lite',
  thinkingLevel: 'minimal' as const,
  schema: MonitoringJudgeSchema,
  systemPrompt: `あなたは Citation Detection エンジンです。AI 検索エンジンの回答（テキスト）と、その引用ソース一覧を受け取り、対象ドメインが引用されているかを判定します。

判定ルール:
- cited: 回答本文に対象ドメインの URL またはドメイン名が明示的に登場、もしくは引用ソース配列に含まれていれば true。
- position: cited=true の場合、回答中で何番目の引用か（1 始まり）。引用ソースのみで本文には無い場合は position=null。
- snippet: 引用元として参照された本文の前後 120 字を抜粋。なければ空文字。
- competitor_domains: 引用ソース配列から自社ドメイン以外を最大 10 件まで（重複除く）。

判定対象に該当しない場合は cited=false を返し、他フィールドは空にする。`,
  buildUserPrompt(input: {
    targetDomain: string;
    engine: string;
    answer: string;
    citations: string[];
  }) {
    return `対象ドメイン: ${input.targetDomain}
エンジン: ${input.engine}

AI 回答本文:
${input.answer.slice(0, 6000)}

引用ソース URL 一覧:
${JSON.stringify(input.citations).slice(0, 4000)}

判定結果を JSON で返してください。`;
  },
};
