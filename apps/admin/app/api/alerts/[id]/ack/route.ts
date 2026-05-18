import { NextResponse } from "next/server";
import { ackAlert } from "@coreberg/observability";
import { requireAdmin } from "@/lib/auth/admin-guard";
import { getServiceClient } from "@/lib/supabase/service";

export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const { user } = await requireAdmin();
  await ackAlert(getServiceClient(), params.id, user.id);
  return NextResponse.json({ ok: true });
}
