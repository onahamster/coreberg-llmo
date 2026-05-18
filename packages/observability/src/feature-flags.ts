import type { SupabaseClient } from "@supabase/supabase-js";

export interface FlagContext {
  userId?: string | null;
  projectId?: string | null;
  plan?: string | null;
}

export interface FlagRow {
  key: string;
  enabled: boolean;
  rollout_percent: number;
  allowed_user_ids: string[];
  allowed_plans: string[];
  disallowed_user_ids: string[];
  variants: Record<string, number>;
}

export interface FlagsClient {
  isEnabled(key: string, ctx?: FlagContext): Promise<boolean>;
  variant(key: string, ctx?: FlagContext): Promise<string | null>;
  preload(keys: string[]): Promise<void>;
  invalidate(): void;
}

const CACHE_TTL_MS = 30_000;

export function createFlagsClient(sb: SupabaseClient): FlagsClient {
  let cache: Map<string, FlagRow> | null = null;
  let cacheAt = 0;
  const load = async () => {
    if (cache && Date.now() - cacheAt < CACHE_TTL_MS) return cache;
    const { data, error } = await sb.from("feature_flags").select("*");
    if (error) throw error;
    cache = new Map<string, FlagRow>();
    for (const row of data ?? []) cache.set(row.key, row as FlagRow);
    cacheAt = Date.now();
    return cache;
  };
  return {
    async isEnabled(key, ctx = {}) {
      const map = await load();
      const f = map.get(key);
      if (!f) return false;
      return evaluate(f, ctx);
    },
    async variant(key, ctx = {}) {
      const map = await load();
      const f = map.get(key);
      if (!f || !evaluate(f, ctx)) return null;
      return chooseVariant(f, ctx);
    },
    async preload(keys) { await load(); void keys; },
    invalidate() { cache = null; },
  };
}

export function evaluate(f: FlagRow, ctx: FlagContext): boolean {
  if (!f.enabled) return false;
  if (ctx.userId && f.disallowed_user_ids.includes(ctx.userId)) return false;
  if (ctx.userId && f.allowed_user_ids.includes(ctx.userId)) return true;
  if (ctx.plan && f.allowed_plans.includes(ctx.plan)) return true;
  if (f.rollout_percent >= 100) return true;
  if (f.rollout_percent <= 0) return false;
  const bucket = bucketFor(`${f.key}:${ctx.userId ?? ctx.projectId ?? "anon"}`);
  return bucket < f.rollout_percent;
}

function chooseVariant(f: FlagRow, ctx: FlagContext): string | null {
  const variants = Object.entries(f.variants);
  if (variants.length === 0) return "on";
  const total = variants.reduce((s, [, w]) => s + (w as number), 0);
  if (total <= 0) return variants[0][0];
  const bucket = bucketFor(`${f.key}:variant:${ctx.userId ?? ctx.projectId ?? "anon"}`) * total / 100;
  let acc = 0;
  for (const [name, w] of variants) {
    acc += w as number;
    if (bucket < acc) return name;
  }
  return variants[variants.length - 1][0];
}

/** Deterministic bucket 0..99 via FNV-1a. */
function bucketFor(key: string): number {
  let hash = 2166136261;
  for (let i = 0; i < key.length; i++) {
    hash ^= key.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return Math.abs(hash) % 100;
}
