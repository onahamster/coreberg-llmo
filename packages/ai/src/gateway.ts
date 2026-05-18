/**
 * Gemini API への薄いクライアント。AI Gateway URL が設定されていれば
 * その経由でリクエストする。
 */
export interface GenerateOptions {
  model: string;
  systemInstruction?: string;
  contents: GeminiContent[];
  responseSchema?: object;
  responseMimeType?: 'application/json' | 'text/plain';
  thinkingLevel?: 'minimal' | 'low' | 'medium' | 'high';
  tools?: GeminiTool[];
  temperature?: number;
  maxOutputTokens?: number;
}

export interface GeminiContent {
  role: 'user' | 'model';
  parts: GeminiPart[];
}

export type GeminiPart =
  | { text: string }
  | { inlineData: { mimeType: string; data: string } }
  | { fileData: { mimeType: string; fileUri: string } };

export type GeminiTool =
  | { googleSearch: Record<string, never> }
  | { urlContext: Record<string, never> };

export interface GenerateResult<T = unknown> {
  json: T | null;
  text: string;
  usage: {
    inputTokens: number;
    outputTokens: number;
    thinkingTokens: number;
  };
  raw: unknown;
}

export interface GatewayConfig {
  apiKey: string;
  gatewayUrl?: string;
}

const DEFAULT_BASE = 'https://generativelanguage.googleapis.com/v1beta';

function resolveEndpoint(config: GatewayConfig, model: string): string {
  const base = config.gatewayUrl?.replace(/\/$/, '') ?? DEFAULT_BASE;
  // AI Gateway 経由でも同じパス構造を維持
  return `${base}/models/${model}:generateContent`;
}

export async function generateContent<T = unknown>(
  config: GatewayConfig,
  options: GenerateOptions,
): Promise<GenerateResult<T>> {
  const url = resolveEndpoint(config, options.model);
  const body: Record<string, unknown> = {
    contents: options.contents,
    generationConfig: {
      temperature: options.temperature ?? 0.7,
      ...(options.maxOutputTokens ? { maxOutputTokens: options.maxOutputTokens } : {}),
      ...(options.responseMimeType ? { responseMimeType: options.responseMimeType } : {}),
      ...(options.responseSchema ? { responseSchema: options.responseSchema } : {}),
      ...(options.thinkingLevel
        ? { thinkingConfig: { thinkingLevel: options.thinkingLevel } }
        : {}),
    },
  };
  if (options.systemInstruction) {
    body.systemInstruction = { role: 'system', parts: [{ text: options.systemInstruction }] };
  }
  if (options.tools) {
    body.tools = options.tools;
  }

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-goog-api-key': config.apiKey,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`Gemini API ${res.status}: ${txt.slice(0, 500)}`);
  }

  const data = (await res.json()) as GeminiResponse;
  const candidate = data.candidates?.[0];
  const textParts = (candidate?.content?.parts ?? [])
    .map((p) => ('text' in p ? p.text : ''))
    .filter(Boolean);
  const text = textParts.join('');
  let json: T | null = null;
  if (options.responseMimeType === 'application/json' && text) {
    try {
      json = JSON.parse(text) as T;
    } catch {
      json = null;
    }
  }

  return {
    json,
    text,
    usage: {
      inputTokens: data.usageMetadata?.promptTokenCount ?? 0,
      outputTokens: data.usageMetadata?.candidatesTokenCount ?? 0,
      thinkingTokens: data.usageMetadata?.thoughtsTokenCount ?? 0,
    },
    raw: data,
  };
}

interface GeminiResponse {
  candidates?: Array<{
    content?: { role?: string; parts?: Array<{ text?: string }> };
    finishReason?: string;
  }>;
  usageMetadata?: {
    promptTokenCount?: number;
    candidatesTokenCount?: number;
    thoughtsTokenCount?: number;
  };
}

/**
 * 画像生成専用エンドポイント (Gemini 3.1 Flash Image)
 */
export async function generateImage(
  config: GatewayConfig,
  options: { prompt: string; aspectRatio?: '1:1' | '16:9' | '9:16' },
): Promise<{ base64: string; mimeType: string; raw: unknown }> {
  const model = 'gemini-3.1-flash-image';
  const url = resolveEndpoint(config, model);
  const body = {
    contents: [{ role: 'user', parts: [{ text: options.prompt }] }],
    generationConfig: {
      responseModalities: ['Image'],
      ...(options.aspectRatio ? { imageConfig: { aspectRatio: options.aspectRatio } } : {}),
    },
  };

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': config.apiKey },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`Gemini Image API ${res.status}: ${txt.slice(0, 500)}`);
  }
  const data = (await res.json()) as {
    candidates?: Array<{
      content?: { parts?: Array<{ inlineData?: { mimeType: string; data: string } }> };
    }>;
  };
  const inline = data.candidates?.[0]?.content?.parts?.find(
    (p): p is { inlineData: { mimeType: string; data: string } } => 'inlineData' in p,
  );
  if (!inline) {
    throw new Error('Gemini image response had no inlineData');
  }
  return {
    base64: inline.inlineData.data,
    mimeType: inline.inlineData.mimeType,
    raw: data,
  };
}
