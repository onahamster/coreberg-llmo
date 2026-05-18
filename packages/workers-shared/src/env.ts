import type { Workflow, Queue, DurableObjectNamespace } from '@cloudflare/workers-types';

/**
 * apps/workers の Worker が受け取るバインディング一式
 */
export interface WorkersEnv {
  // Workflows
  ONBOARDING_WORKFLOW: Workflow;
  GENERATION_WORKFLOW: Workflow;
  MONITORING_WORKFLOW: Workflow;
  LEARNING_WORKFLOW: Workflow;

  // Queues (producer 側のバインディング)
  ARTICLE_QUEUE: Queue<ArticleQueueMessage>;
  MONITORING_QUEUE: Queue<MonitoringQueueMessage>;

  // Durable Objects
  PROGRESS_DO: DurableObjectNamespace;

  // 環境変数 / Secrets
  SUPABASE_URL: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
  AI_GATEWAY_URL?: string;
  GEMINI_API_KEY: string;
  QUEUE_HMAC_SECRET: string;

  // 外部 API
  SERPAPI_KEY?: string;
  PERPLEXITY_API_KEY?: string;
  OPENAI_API_KEY?: string;
  PAGESPEED_API_KEY?: string;
  INDEXNOW_KEY?: string;
  RESEND_API_KEY?: string;
}

// ---------------------------------------------------------------------------
// Queue メッセージ型
// ---------------------------------------------------------------------------
export interface ArticleQueueMessage {
  kind: 'article.generate';
  generationRunId: string;
  planId: string;
  articleId: string;
  projectId: string;
  userId: string;
  /** 6.1 → 6.5 のどのサブステップから開始するか */
  startStep: 'draft' | 'check' | 'fact' | 'html' | 'image';
  attempt: number;
}

export interface MonitoringQueueMessage {
  kind: 'monitoring.check';
  articleId: string;
  subqueryId: string;
  projectId: string;
  engine: 'chatgpt' | 'perplexity' | 'gemini' | 'google_ai_overview';
  scheduledFor: string; // ISO
}
