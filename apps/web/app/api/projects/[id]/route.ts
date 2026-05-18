import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireCustomer } from '@/lib/auth/customer-guard';
import { createServerSupabase } from '@/lib/supabase/server';
import { createServiceSupabase } from '@/lib/supabase/service';

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  await requireCustomer();
  const supabase = await createServerSupabase();
  const { id } = await params;

  const { data, error } = await supabase
    .from('projects')
    .select(
      'id,name,site_url,site_profile_jsonb,audit_jsonb,monthly_article_count,status,created_at',
    )
    .eq('id', id)
    .is('deleted_at', null)
    .maybeSingle();

  if (error || !data) return NextResponse.json({ error: 'not_found' }, { status: 404 });
  return NextResponse.json(data);
}

const patchSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  target_audience: z.string().max(2000).nullable().optional(),
  target_locale: z.enum(['ja', 'en']).optional(),
  monthly_article_count: z.number().int().min(1).max(100).optional(),
  wp_endpoint: z.string().url().nullable().optional().or(z.literal('')),
  wp_username: z.string().nullable().optional(),
});

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { userId } = await requireCustomer();
  const { id } = await params;
  const body = await request.json().catch(() => null);
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 });
  }

  const admin = createServiceSupabase();
  const { error } = await admin
    .from('projects')
    .update(parsed.data)
    .eq('id', id)
    .eq('user_id', userId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
