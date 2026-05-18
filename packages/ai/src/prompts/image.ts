export const imagePrompt = {
  key: 'image',
  model: 'gemini-3.1-flash-image',
  systemPrompt: null,
  /**
   * Gemini 3.1 Flash Image はテキストのみのプロンプトで動く。
   * ここでは alt text と画像プロンプトを LLM ではなくテンプレートで作る。
   */
  buildImagePrompt(input: {
    title: string;
    industry: string;
    tone: string;
  }): { imagePrompt: string; alt: string } {
    const base = `Editorial illustration for a business article titled "${input.title}". Industry context: ${input.industry}. Visual tone: ${input.tone}, minimalist, soft gradients, light background, no human faces, no embedded text or letters. Wide 16:9 composition suitable for blog header.`;
    const alt = `${input.title}を表すアイキャッチイラスト`;
    return { imagePrompt: base, alt };
  },
};
