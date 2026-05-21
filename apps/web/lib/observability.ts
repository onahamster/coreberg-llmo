import { Logger, Tracer, captureException, setUserContext } from "@coreberg/observability";
import { createClient } from "@/lib/supabase/client";

export interface Observed {
  logger: Logger;
  trace: ReturnType<Tracer["start"]>;
}

export function startObserved(req: Request, opts: {
  source: string; routeTemplate: string; userId?: string | null; projectId?: string | null;
}): Observed {
  // Create an authenticated client to write logs via standard RLS policies
  const sb = createClient();
  const requestId = req.headers.get("x-request-id") ?? crypto.randomUUID();
  const traceId = req.headers.get("x-trace-id") ?? requestId;
  const logger = new Logger(
    {
      source: opts.source,
      requestId,
      traceId,
      userId: opts.userId,
      projectId: opts.projectId,
      release: process.env.NEXT_PUBLIC_SENTRY_RELEASE,
    },
    { sb } as any,
  );
  const tracer = new Tracer(sb as any, Number(process.env.TRACE_SAMPLING_RATE ?? "0.2"));
  const trace = tracer.start({
    source: opts.source,
    route: opts.routeTemplate,
    method: req.method,
    userId: opts.userId,
    projectId: opts.projectId,
  });
  if (opts.userId) setUserContext({ id: opts.userId });
  return { logger, trace };
}

export async function finishObserved(
  obs: Observed, res: Response | { status: number }, error?: unknown,
): Promise<void> {
  if (error) captureException(error);
  await obs.trace.finish(res.status, obs.logger);
  await obs.logger.flushNow();
}
