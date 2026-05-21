import { NextResponse } from "next/server";
import { resolveAlert } from "@coreberg/observability";
import { requireAdmin } from "@/lib/auth/admin-guard";
import { getServiceClient } from "@/lib/supabase/service";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;
  await resolveAlert(getServiceClient(), id);
  return NextResponse.json({ ok: true });
}
