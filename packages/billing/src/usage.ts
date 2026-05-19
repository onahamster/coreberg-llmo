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
    // M-13 修正: RPC 失敗時は fail-closed（課金漏れ防止）
    // allowed: true を返していたため、DB 障害時に無制限利用が許可されていた
    console.error('checkArticleQuota RPC failed', error?.message);
    return { allowed: false, remaining: 0, willOverage: false };
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
