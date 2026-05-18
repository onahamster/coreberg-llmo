import { WorkflowEntrypoint, type WorkflowEvent, type WorkflowStep } from "cloudflare:workers";
import { runDefaultProbes, recordProbes, raiseAlert } from "@coreberg/observability";
import { getServiceClient } from "../db";
import type { WorkersEnv } from "../env";

export class MetricsRefreshWorkflow extends WorkflowEntrypoint<WorkersEnv> {
  async run(_e: WorkflowEvent<unknown>, step: WorkflowStep) {
    const sb = getServiceClient(this.env);

    await step.do("refresh-request-metrics", async () => {
      await sb.rpc("refresh_request_metrics");
    });

    await step.do("refresh-ai-cost", async () => {
      await sb.rpc("refresh_ai_cost_daily");
    });

    await step.do("health-probes", async () => {
      const results = await runDefaultProbes({
        STRIPE_SECRET_KEY: this.env.STRIPE_SECRET_KEY,
        RESEND_API_KEY: this.env.RESEND_API_KEY,
        OPENAI_API_KEY: this.env.OPENAI_API_KEY,
        SUPABASE_URL: this.env.SUPABASE_URL,
      });
      await recordProbes(sb, results);
      for (const r of results) {
        if (!r.ok) {
          await raiseAlert(sb, {
            key: `probe.${r.key}.down`,
            severity: "critical",
            title: `External dependency unhealthy: ${r.key}`,
            detail: { statusCode: r.statusCode, error: r.error, duration_ms: r.durationMs },
          });
        }
      }
    });

    await step.do("cost-spike-check", async () => {
      const { data } = await sb
        .from("ai_cost_daily_cache")
        .select("day, cost_cents")
        .gte("day", new Date(Date.now() - 14 * 86400_000).toISOString().slice(0, 10))
        .order("day", { ascending: false });
      const rows = data ?? [];
      if (rows.length < 8) return;
      const today = Number(rows[0].cost_cents);
      const baseline = rows.slice(1, 8).reduce((s, r) => s + Number(r.cost_cents), 0) / 7;
      if (baseline > 0 && today > baseline * 2 && today > 100_00 /* ¥10,000 */) {
        await raiseAlert(sb, {
          key: "ai_cost.daily_spike",
          severity: "warning",
          title: `AI cost spike: today ¥${Math.round(today / 100)} vs 7-day avg ¥${Math.round(baseline / 100)}`,
          detail: { today_cents: today, baseline_cents: Math.round(baseline) },
        });
      }
    });
  }
}
