import { NextResponse } from "next/server";
import { WordPressClient } from "@coreberg/wordpress";
import { createServiceSupabase } from "@/lib/supabase/service";
import { requireProjectAccess } from "@/lib/auth/customer-guard";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  await requireProjectAccess(id);
  const body = await req.json().catch(() => ({}));
  const { siteUrl, username, appPassword } = body as Record<string, string>;

  if (!siteUrl || !username || !appPassword) {
    return NextResponse.json({ error: "missing_fields" }, { status: 400 });
  }

  try {
    const client = new WordPressClient({ siteUrl, username, appPassword });
    const result = await client.verify();
    // Store credentials via RPC
    const sb = createServiceSupabase();
    await sb.rpc("project_set_wp_password", {
      p_project_id: id,
      p_username: username,
      p_password: appPassword,
    });
    await sb
      .from("projects")
      .update({ site_url: siteUrl, wp_verified_at: new Date().toISOString() })
      .eq("id", id);
    return NextResponse.json({ ok: true, user: result.user });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: (err as Error).message },
      { status: 400 },
    );
  }
}
