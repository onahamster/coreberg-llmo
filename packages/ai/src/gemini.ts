import type { GatewayConfig } from './gateway';
import { generateContent, generateImage, type GenerateOptions, type GenerateResult } from './gateway';

/**
 * 環境変数から GatewayConfig を組み立てる薄いヘルパー
 * フォールバック用の Anthropic / OpenAI キーも読み込む
 */
export function configFromEnv(env: {
  GEMINI_API_KEY: string;
  AI_GATEWAY_URL?: string;
  ANTHROPIC_API_KEY?: string;
  OPENAI_API_KEY?: string;
}): GatewayConfig {
  return {
    apiKey: env.GEMINI_API_KEY,
    gatewayUrl: env.AI_GATEWAY_URL,
    anthropicApiKey: env.ANTHROPIC_API_KEY,
    openaiApiKey: env.OPENAI_API_KEY,
  };
}

export type { GenerateOptions, GenerateResult };
export { generateContent, generateImage };
