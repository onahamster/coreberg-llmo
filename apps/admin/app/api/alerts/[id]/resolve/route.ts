import { NextResponse } from "next/server";
import { resolveAlert } from "@coreberg/observability";
import { requireAdmin } from "@/lib/auth/admin-guard";
import { getServiceClient } from "@/lib/supabase/service";

export async function POST(_req: Request, { params }: { params: { id: string } }) {
  await requireAdmin();
  await resolveAlert(getServiceClient(), params.id);
  return NextResponse.json({ ok: true });
}
