import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/admin-guard";
import { getServiceClient } from "@/lib/supabase/service";

export async function PATCH(req: Request, { params }: { params: { key: string } }) {
  const { user } = await requireAdmin();
  const patch = await req.json();
  const sb = getServiceClient();
  
  const allowed: Record<string, any> = {};
  for (const k of ["enabled","rollout_percent","allowed_user_ids","allowed_plans","disallowed_user_ids","variants","description"]) {
    if (k in patch) {
      allowed[k] = patch[k];
    }
  }
  allowed.updated_by = user.id;

  const { error } = await sb
    .from("feature_flags")
    .update(allowed)
    .eq("key", params.key);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Record flag modification in audit logs
  try {
    await sb.from("audit_logs").insert({
      actor_id: user.id,
      actor_type: "admin",
      action: "feature_flag.updated",
      target_type: "feature_flag",
      target_id: params.key,
      metadata: allowed,
    });
  } catch (e) {
    // Fallback if audit_logs table does not exist or has RLS bypass
  }

  return NextResponse.json({ ok: true });
}
