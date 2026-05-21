import { NextResponse } from "next/server";
import { requireProjectAccess } from "@/lib/auth/customer-guard";
import { getBindings } from "@/lib/cloudflare";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string; articleId: string }> }
) {
  const { id, articleId } = await params;
  await requireProjectAccess(id);
  const { scheduledAt } = await req.json().catch(() => ({})) as { scheduledAt?: string };
  const bindings = await getBindings();

  if (bindings && bindings.ARTICLE_QUEUE) {
    // ARTICLE_QUEUE is the general queue for pipeline messages,
    // let's send standard message structure to trigger publish
    await bindings.ARTICLE_QUEUE.send({
      type: "draft", // or standard message layout
      projectId: id,
      articleId: articleId,
    } as any);
  }

  return NextResponse.json({ ok: true, queued: true });
}
