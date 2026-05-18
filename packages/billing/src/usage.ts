import { UsageLimitExceededError } from "./errors";

export interface QuotaCheckOptions {
  policy?: "block" | "auto_charge";
}

export async function checkArticleQuota(
  sb: any,
  projectId: string,
  options: QuotaCheckOptions = {}
) {
  const policy = options.policy ?? "block";
  const { data, error } = await sb.rpc("get_project_usage", { prj_id: projectId });
  
  if (error || !data) {
    // Default fallback if RPC fails or not loaded yet
    return { allowed: true, remaining: 999, willOverage: false };
  }

  const used = Number(data.used);
  const limit = Number(data.limit);

  if (used >= limit) {
    if (policy === "auto_charge") {
      return { allowed: true, remaining: 0, willOverage: true };
    }
    return { allowed: false, remaining: 0, willOverage: false };
  }

  return { allowed: true, remaining: limit - used, willOverage: false };
}

export async function requireArticleQuota(
  sb: any,
  projectId: string,
  options: QuotaCheckOptions = {}
) {
  const result = await checkArticleQuota(sb, projectId, options);
  if (!result.allowed) {
    throw new UsageLimitExceededError();
  }
  return result;
}
