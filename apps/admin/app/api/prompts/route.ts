import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdmin } from '@/lib/auth/admin-guard';
import { createServiceSupabase } from '@/lib/supabase/service';

const promptUpsertSchema = z.object({
  key: z.string().min(1),
  system_prompt: z.string(),
  user_prompt_template: z.string(),
  version: z.number().int().min(1),
  is_active: z.boolean(),
});

export async function POST(request: Request) {
  const { userId } = await requireAdmin();
  const body = await request.json().catch(() => null);
  const parsed = promptUpsertSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid_body', details: parsed.error.flatten() }, { status: 400 });
  }

  const input = parsed.data;
  const admin = createServiceSupabase();

  // service_role のみ呼び出し可能な RPC admin_upsert_prompt を経由して挿入
  const { data: promptId, error } = await admin.rpc('admin_upsert_prompt', {
    p_key: input.key,
    p_system_prompt: input.system_prompt,
    p_user_prompt_template: input.user_prompt_template,
    p_version: input.version,
    p_is_active: input.is_active,
  });

  if (error || !promptId) {
    return NextResponse.json({ error: 'upsert_failed', message: error?.message }, { status: 500 });
  }

  // 監査ログ
  await admin.rpc('log_audit', {
    p_actor_id: userId,
    p_actor_role: 'admin',
    p_action: 'prompt.upserted',
    p_resource_type: 'prompt',
    p_resource_id: promptId,
    p_target_user_id: null,
    p_metadata: { key: input.key, version: input.version },
    p_actor_ip: request.headers.get('cf-connecting-ip'),
    p_actor_user_agent: request.headers.get('user-agent'),
  });

  return NextResponse.json({ promptId });
}
