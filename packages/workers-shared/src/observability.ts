import { withSentry, initSentry, Logger } from "@coreberg/observability";
import { getServiceClient } from "./db";
import type { WorkersEnv } from "./env";

export function bootstrap(env: WorkersEnv): { logger: Logger } {
  initSentry({
    SENTRY_DSN: env.SENTRY_DSN,
    SENTRY_ENVIRONMENT: env.SENTRY_ENVIRONMENT,
    SENTRY_RELEASE: env.SENTRY_RELEASE,
    SENTRY_TRACES_SAMPLE_RATE: env.SENTRY_TRACES_SAMPLE_RATE,
  });
  const sb = getServiceClient(env);
  const logger = new Logger(
    { source: "workers", release: env.SENTRY_RELEASE },
    { sb } as any,
  );
  return { logger };
}

export { withSentry };
