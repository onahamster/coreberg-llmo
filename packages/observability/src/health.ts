import type { SupabaseClient } from "@supabase/supabase-js";

export interface ProbeResult {
  key: string;
  ok: boolean;
  statusCode?: number;
  durationMs: number;
  error?: string;
}

export async function probe(
  key: string,
  fn: () => Promise<{ ok: boolean; statusCode?: number }>,
): Promise<ProbeResult> {
  const t0 = performance.now();
  try {
    const r = await fn();
    return { key, ok: r.ok, statusCode: r.statusCode, durationMs: Math.round(performance.now() - t0) };
  } catch (err) {
    return { key, ok: false, durationMs: Math.round(performance.now() - t0), error: (err as Error).message };
  }
}

export async function recordProbes(sb: SupabaseClient, results: ProbeResult[]): Promise<void> {
  if (results.length === 0) return;
  await sb.from("health_probes").insert(
    results.map((r) => ({
      probe_key: r.key, ok: r.ok, status_code: r.statusCode ?? null,
      duration_ms: r.durationMs, error: r.error ?? null,
    })),
  );
}

export async function runDefaultProbes(env: {
  STRIPE_SECRET_KEY?: string; RESEND_API_KEY?: string;
  OPENAI_API_KEY?: string; SUPABASE_URL?: string;
}): Promise<ProbeResult[]> {
  const checks: Promise<ProbeResult>[] = [];
  if (env.SUPABASE_URL) {
    checks.push(probe("supabase", async () => {
      const r = await fetch(`${env.SUPABASE_URL}/auth/v1/health`);
      return { ok: r.ok, statusCode: r.status };
    }));
  }
  if (env.STRIPE_SECRET_KEY) {
    checks.push(probe("stripe", async () => {
      const r = await fetch("https://api.stripe.com/v1/charges?limit=1", {
        headers: { Authorization: `Bearer ${env.STRIPE_SECRET_KEY}` },
      });
      return { ok: r.ok, statusCode: r.status };
    }));
  }
  if (env.RESEND_API_KEY) {
    checks.push(probe("resend", async () => {
      const r = await fetch("https://api.resend.com/domains", {
        headers: { Authorization: `Bearer ${env.RESEND_API_KEY}` },
      });
      return { ok: r.ok, statusCode: r.status };
    }));
  }
  if (env.OPENAI_API_KEY) {
    checks.push(probe("openai", async () => {
      const r = await fetch("https://api.openai.com/v1/models", {
        headers: { Authorization: `Bearer ${env.OPENAI_API_KEY}` },
      });
      return { ok: r.ok, statusCode: r.status };
    }));
  }
  return Promise.all(checks);
}
