/**
 * プロバイダ抽象化 AI Gateway クライアント
 *
 * モデル名のプレフィックスでプロバイダを自動判定し、
 * 各 API のペイロード形式に変換する。
 *
 *   gemini-*    → Google AI (Gemini) API
 *   claude-*    → Anthropic Messages API
 *   gpt-*       → OpenAI Chat Completions API
 *
 * これにより、プロンプト側のコードを一切変更せずに環境変数の
 * モデル ID を切り替えるだけでフォールバックが機能する。
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
  /** Anthropic API キー (claude-* モデルへのフォールバック用) */
  anthropicApiKey?: string;
  /** OpenAI API キー (gpt-* モデルへのフォールバック用) */
  openaiApiKey?: string;
}

/** モデル名からプロバイダを判定する */
function detectProvider(model: string): 'gemini' | 'anthropic' | 'openai' {
  if (model.startsWith('claude-')) return 'anthropic';
  if (model.startsWith('gpt-') || model.startsWith('o1') || model.startsWith('o3')) return 'openai';
  return 'gemini';
}

const DEFAULT_GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta';
const DEFAULT_ANTHROPIC_BASE = 'https://api.anthropic.com/v1';
const DEFAULT_OPENAI_BASE = 'https://api.openai.com/v1';

function resolveEndpoint(config: GatewayConfig, model: string): string {
  const provider = detectProvider(model);
  if (provider === 'anthropic') {
    return config.gatewayUrl
      ? `${config.gatewayUrl.replace(/\/$/, '')}/anthropic/messages`
      : `${DEFAULT_ANTHROPIC_BASE}/messages`;
  }
  if (provider === 'openai') {
    return config.gatewayUrl
      ? `${config.gatewayUrl.replace(/\/$/, '')}/openai/chat/completions`
      : `${DEFAULT_OPENAI_BASE}/chat/completions`;
  }
  // Gemini
  const base = config.gatewayUrl?.replace(/\/$/, '') ?? DEFAULT_GEMINI_BASE;
  return `${base}/models/${model}:generateContent`;
}

export async function generateContent<T = unknown>(
  config: GatewayConfig,
  options: GenerateOptions,
): Promise<GenerateResult<T>> {
  const provider = detectProvider(options.model);

  if (provider === 'anthropic') {
    return generateContentAnthropic<T>(config, options);
  }
  if (provider === 'openai') {
    return generateContentOpenAI<T>(config, options);
  }
  return generateContentGemini<T>(config, options);
}

// ---------------------------------------------------------------------------
// Gemini (Google AI)
// ---------------------------------------------------------------------------
async function generateContentGemini<T = unknown>(
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

// ---------------------------------------------------------------------------
// Anthropic (Claude)
// ---------------------------------------------------------------------------
async function generateContentAnthropic<T = unknown>(
  config: GatewayConfig,
  options: GenerateOptions,
): Promise<GenerateResult<T>> {
  const apiKey = config.anthropicApiKey;
  if (!apiKey) throw new Error('anthropicApiKey is required for claude-* models');

  const url = resolveEndpoint(config, options.model);
  // Gemini の GeminiContent[] を Anthropic Messages 形式に変換
  const messages = options.contents.map((c) => ({
    role: c.role === 'model' ? 'assistant' : 'user',
    content: c.parts
      .map((p) => ('text' in p ? { type: 'text', text: p.text } : null))
      .filter(Boolean),
  }));

  const body: Record<string, unknown> = {
    model: options.model,
    max_tokens: options.maxOutputTokens ?? 8192,
    messages,
    ...(options.systemInstruction ? { system: options.systemInstruction } : {}),
  };

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`Anthropic API ${res.status}: ${txt.slice(0, 500)}`);
  }

  const data = (await res.json()) as {
    content?: Array<{ type: string; text?: string }>;
    usage?: { input_tokens?: number; output_tokens?: number };
  };
  const text = (data.content ?? [])
    .filter((b) => b.type === 'text')
    .map((b) => b.text ?? '')
    .join('');
  let json: T | null = null;
  if (options.responseMimeType === 'application/json' && text) {
    try { json = JSON.parse(text) as T; } catch { json = null; }
  }
  return {
    json,
    text,
    usage: {
      inputTokens: data.usage?.input_tokens ?? 0,
      outputTokens: data.usage?.output_tokens ?? 0,
      thinkingTokens: 0,
    },
    raw: data,
  };
}

// ---------------------------------------------------------------------------
// OpenAI (GPT)
// ---------------------------------------------------------------------------
async function generateContentOpenAI<T = unknown>(
  config: GatewayConfig,
  options: GenerateOptions,
): Promise<GenerateResult<T>> {
  const apiKey = config.openaiApiKey;
  if (!apiKey) throw new Error('openaiApiKey is required for gpt-* models');

  const url = resolveEndpoint(config, options.model);
  // Gemini の GeminiContent[] を OpenAI ChatCompletion 形式に変換
  const messages: { role: string; content: string }[] = [];
  if (options.systemInstruction) {
    messages.push({ role: 'system', content: options.systemInstruction });
  }
  for (const c of options.contents) {
    const content = c.parts.map((p) => ('text' in p ? p.text : '')).join('');
    messages.push({ role: c.role === 'model' ? 'assistant' : 'user', content });
  }

  const body: Record<string, unknown> = {
    model: options.model,
    messages,
    temperature: options.temperature ?? 0.7,
    ...(options.maxOutputTokens ? { max_tokens: options.maxOutputTokens } : {}),
    ...(options.responseMimeType === 'application/json'
      ? { response_format: { type: 'json_object' } }
      : {}),
  };

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`OpenAI API ${res.status}: ${txt.slice(0, 500)}`);
  }

  const data = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
    usage?: { prompt_tokens?: number; completion_tokens?: number };
  };
  const text = data.choices?.[0]?.message?.content ?? '';
  let json: T | null = null;
  if (options.responseMimeType === 'application/json' && text) {
    try { json = JSON.parse(text) as T; } catch { json = null; }
  }
  return {
    json,
    text,
    usage: {
      inputTokens: data.usage?.prompt_tokens ?? 0,
      outputTokens: data.usage?.completion_tokens ?? 0,
      thinkingTokens: 0,
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
