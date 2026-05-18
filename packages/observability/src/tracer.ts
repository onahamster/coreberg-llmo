import type { SupabaseClient } from "@supabase/supabase-js";
import type { Logger } from "./logger";

export interface TraceInput {
  source: string;
  route: string;        // already normalized e.g. "/api/projects/[id]"
  method: string;
  userId?: string | null;
  projectId?: string | null;
}

export interface FinishedTrace extends TraceInput {
  traceId: string;
  statusCode: number;
  durationMs: number;
  attributes: Record<string, unknown>;
}

export class Tracer {
  constructor(private sb: SupabaseClient | null, private samplingRate = 1) {}

  start(input: TraceInput, traceId = crypto.randomUUID()) {
    const startedAt = performance.now();
    const attrs: Record<string, unknown> = {};
    return {
      traceId,
      setAttr: (k: string, v: unknown) => { attrs[k] = v; },
      finish: async (statusCode: number, logger?: Logger) => {
        const durationMs = Math.round(performance.now() - startedAt);
        const finished: FinishedTrace = {
          ...input, traceId, statusCode, durationMs, attributes: attrs,
        };
        await this.persist(finished, logger);
        return finished;
      },
    };
  }

  private async persist(t: FinishedTrace, logger?: Logger) {
    // Always sample errors and slow requests; otherwise apply samplingRate.
    const force = t.statusCode >= 500 || t.durationMs > 1500;
    if (!force && Math.random() > this.samplingRate) return;
    if (!this.sb) return;
    try {
      await this.sb.from("request_traces").insert({
        trace_id: t.traceId,
        source: t.source,
        route: t.route,
        method: t.method,
        status_code: t.statusCode,
        duration_ms: t.durationMs,
        user_id: t.userId ?? null,
        project_id: t.projectId ?? null,
        attributes: t.attributes,
      });
    } catch (err) {
      logger?.warn("tracer.persist_failed", { error: (err as Error).message });
    }
  }
}

/** Normalize Next.js dynamic route params for traces, e.g. /projects/abc -> /projects/[id]. */
export function normalizeRoute(pathname: string, params?: Record<string, string>): string {
  if (!params) return pathname;
  let out = pathname;
  for (const [k, v] of Object.entries(params)) {
    out = out.replaceAll(`/${v}`, `/[${k}]`);
  }
  return out;
}
