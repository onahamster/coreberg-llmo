/**
 * Gemini モデル料金 (USD per 1M tokens / per image)
 * 2026年5月時点の試算値。実際の請求は AI Gateway 経由のログで確定させる。
 */
export const PRICING = {
  'gemini-3-flash': { input: 0.5, output: 3.0 }, // thinking 込み
  'gemini-3.1-flash-lite': { input: 0.1, output: 0.4 },
  'gemini-3.1-flash-image': { perImage: 0.067 },
  'claude-4.7-opus': { input: 15.0, output: 75.0 },
  'gpt-5.5': { input: 5.0, output: 15.0 },
} as const;

export type ModelId = keyof typeof PRICING;

export function calcCostCents(
  model: ModelId,
  usage: { inputTokens?: number; outputTokens?: number; images?: number },
): number {
  const price = PRICING[model];
  let cents = 0;
  if ('input' in price && usage.inputTokens) {
    cents += (usage.inputTokens / 1_000_000) * price.input * 100;
  }
  if ('output' in price && usage.outputTokens) {
    cents += (usage.outputTokens / 1_000_000) * price.output * 100;
  }
  if ('perImage' in price && usage.images) {
    cents += usage.images * price.perImage * 100;
  }
  return Math.round(cents);
}
