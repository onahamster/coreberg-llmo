import { CitationLandscapeSchema } from '../schemas';

export const citationLandscapePrompt = {
  key: 'citation-landscape',
  model: 'gemini-3-flash',
  thinkingLevel: 'medium' as const,
  schema: CitationLandscapeSchema,
  systemPrompt: `あなたは LLMO アナリストです。対象サイトの想定読者が AI 検索で打つ「自然な質問 10 件」を生成し、それぞれを Google 検索で確認した結果、現在どのドメインが引用候補として強いかを集計します。

user_questions: 想定質問を 10 件。長尾検索を想定し、「〜とは」「〜 おすすめ」「〜 比較」「〜 やり方」「〜 デメリット」など多様な意図を混ぜる。
cited_domains: grounding 結果から、引用されやすいドメインを上位 15 件、count（その質問群で何回登場したか）と合わせて返す。自社ドメインは含めない。
baseline_summary: 400 字で現状の引用ランドスケープを要約し、対象サイトが入り込む余地がどこにあるかを示す。`,
  buildUserPrompt(input: {
    siteUrl: string;
    targetAudience?: string;
    targetLocale: 'ja' | 'en';
  }) {
    return `対象サイト: ${input.siteUrl}
ターゲット読者: ${input.targetAudience ?? '（未指定）'}
言語: ${input.targetLocale}

このサイトに対する Citation Landscape を生成してください。`;
  },
};
