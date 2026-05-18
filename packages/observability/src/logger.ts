import type { SupabaseClient } from "@supabase/supabase-js";

export type LogLevel = "debug" | "info" | "warn" | "error" | "fatal";

export interface LogContext {
  source: string;
  userId?: string | null;
  projectId?: string | null;
  requestId?: string | null;
  traceId?: string | null;
  release?: string;
}

export interface LogEntry {
  ts: string;
  level: LogLevel;
  source: string;
  event: string;
  message?: string;
  user_id?: string | null;
  project_id?: string | null;
  request_id?: string | null;
  trace_id?: string | null;
  attributes: Record<string, unknown>;
  error_class?: string;
  error_stack?: string;
}

const LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 10, info: 20, warn: 30, error: 40, fatal: 50,
};

export class Logger {
  private buffer: LogEntry[] = [];
  private flushTimer: ReturnType<typeof setTimeout> | null = null;
  private readonly minLevel: number;
  private readonly flushMs: number;
  private readonly batchSize: number;

  constructor(
    private context: LogContext,
    private sink?: { sb: SupabaseClient } | null,
    options?: { minLevel?: LogLevel; flushMs?: number; flushBatchSize?: number },
  ) {
    this.minLevel = LEVEL_PRIORITY[options?.minLevel ?? "info"];
    this.flushMs = options?.flushMs ?? 2000;
    this.batchSize = options?.flushBatchSize ?? 50;
  }

  child(extra: Partial<LogContext>): Logger {
    return new Logger({ ...this.context, ...extra }, this.sink, {
      minLevel: (Object.keys(LEVEL_PRIORITY).find(k => LEVEL_PRIORITY[k as LogLevel] === this.minLevel)) as LogLevel,
      flushMs: this.flushMs,
      flushBatchSize: this.batchSize,
    });
  }

  debug(event: string, attrs?: Record<string, unknown>) { this.log("debug", event, undefined, attrs); }
  info(event: string, attrs?: Record<string, unknown>)  { this.log("info",  event, undefined, attrs); }
  warn(event: string, attrs?: Record<string, unknown>)  { this.log("warn",  event, undefined, attrs); }
  error(event: string, err: unknown, attrs?: Record<string, unknown>) {
    const e = err instanceof Error ? err : new Error(String(err));
    this.log("error", event, e.message, { ...attrs, error_class: e.name, error_stack: e.stack });
  }
  fatal(event: string, err: unknown, attrs?: Record<string, unknown>) {
    const e = err instanceof Error ? err : new Error(String(err));
    this.log("fatal", event, e.message, { ...attrs, error_class: e.name, error_stack: e.stack });
  }

  private log(level: LogLevel, event: string, message?: string, attrs?: Record<string, unknown>) {
    if (LEVEL_PRIORITY[level] < this.minLevel) return;
    const entry: LogEntry = {
      ts: new Date().toISOString(),
      level, source: this.context.source, event, message,
      user_id: this.context.userId ?? null,
      project_id: this.context.projectId ?? null,
      request_id: this.context.requestId ?? null,
      trace_id: this.context.traceId ?? null,
      attributes: stripReserved(attrs ?? {}),
      error_class: attrs?.error_class as string | undefined,
      error_stack: attrs?.error_stack as string | undefined,
    };
    // Console (Cloudflare logs / stdout)
    const line = JSON.stringify({ ...entry, attributes: entry.attributes });
    if (level === "error" || level === "fatal") console.error(line);
    else if (level === "warn") console.warn(line);
    else console.log(line);

    // Sink to DB (async, batched). Skip noisy debug.
    if (this.sink && level !== "debug") {
      this.buffer.push(entry);
      if (this.buffer.length >= this.batchSize) this.flushNow();
      else this.scheduleFlush();
    }
  }

  private scheduleFlush() {
    if (this.flushTimer) return;
    this.flushTimer = setTimeout(() => this.flushNow(), this.flushMs);
  }

  async flushNow(): Promise<void> {
    if (this.flushTimer) { clearTimeout(this.flushTimer); this.flushTimer = null; }
    if (!this.sink || this.buffer.length === 0) return;
    const batch = this.buffer.splice(0, this.buffer.length);
    try {
      await this.sink.sb.from("app_logs").insert(batch);
    } catch (err) {
      // Never throw from logger; fall back to stderr
      console.error("logger.flush_failed", { error: (err as Error).message, lost: batch.length });
    }
  }
}

function stripReserved(o: Record<string, unknown>): Record<string, unknown> {
  const { error_class, error_stack, ...rest } = o;
  return rest;
}

/** Helper: create a logger bound to a fetch request. */
export function loggerForRequest(
  ctx: { source: string; sb?: SupabaseClient | null; release?: string },
  req: Request,
): Logger {
  const requestId = req.headers.get("x-request-id") ?? crypto.randomUUID();
  const traceId = req.headers.get("x-trace-id") ?? requestId;
  return new Logger(
    { source: ctx.source, requestId, traceId, release: ctx.release },
    ctx.sb ? { sb: ctx.sb } : null,
  );
}
