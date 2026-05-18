import type { GatewayConfig } from './gateway';
import { generateContent, generateImage, type GenerateOptions, type GenerateResult } from './gateway';

/**
 * 環境変数から GatewayConfig を組み立てる薄いヘルパー
 */
export function configFromEnv(env: { GEMINI_API_KEY: string; AI_GATEWAY_URL?: string }): GatewayConfig {
  return { apiKey: env.GEMINI_API_KEY, gatewayUrl: env.AI_GATEWAY_URL };
}

export type { GenerateOptions, GenerateResult };
export { generateContent, generateImage };
