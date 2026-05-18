import { WordPressClient, publishArticle } from "@coreberg/wordpress";
import type { WorkersEnv } from "../env";
import { getServiceClient, recordAuditLog } from "../db";

export interface PublishJobInput {
  articleId: string;
  projectId: string;
  scheduledAt?: string;
}

export async function publishArticleJob(
  env: WorkersEnv,
  input: PublishJobInput,
): Promise<{ postId: number; url: string }> {
  const sb = getServiceClient(env);

  // 1. Load article + related plan
  const { data: article, error: artErr } = await sb
    .from("articles")
    .select(
      "id, project_id, title, slug, body_html, json_ld, excerpt, hero_image_url, hero_image_alt, meta_title, meta_description, canonical_url, status",
    )
    .eq("id", input.articleId)
    .single();
  if (artErr || !article) throw new Error(`Article not found: ${input.articleId}`);
  if (article.status !== "ready" && article.status !== "scheduled" && article.status !== "completed") {
    throw new Error(`Article ${article.id} not ready (status=${article.status})`);
  }

  // 2. Load WP credentials via RPC
  const { data: creds, error: credErr } = await sb.rpc("project_get_wp_password", {
    p_project_id: input.projectId,
  });
  if (credErr || !creds || creds.length === 0) {
    throw new Error("WordPress credentials missing");
  }
  const { username, password } = creds[0] as unknown as { username: string; password?: string } & { [key: string]: string };
  const realPassword = password || (creds[0] as unknown as Record<string, string>).wp_app_password || "";

  // 3. Load project site URL
  const { data: project } = await sb
    .from("projects")
    .select("site_url")
    .eq("id", input.projectId)
    .single();
  if (!project) throw new Error("Project not found");

  const client = new WordPressClient({
    siteUrl: project.site_url,
    username,
    appPassword: realPassword,
  });

  // 4. Publish
  const result = await publishArticle(client, {
    title: article.title,
    contentHtml: article.body_html || "",
    jsonLd: article.json_ld || undefined,
    slug: article.slug || "",
    excerpt: article.excerpt ?? undefined,
    status: input.scheduledAt ? "future" : "publish",
    scheduledAt: input.scheduledAt ? new Date(input.scheduledAt) : undefined,
    featuredImage: article.hero_image_url
      ? {
          imageUrl: article.hero_image_url,
          filename: `${article.slug}-hero.png`,
          altText: article.hero_image_alt ?? article.title,
        }
      : undefined,
    seo: {
      metaTitle: article.meta_title ?? undefined,
      metaDescription: article.meta_description ?? undefined,
      canonicalUrl: article.canonical_url ?? undefined,
    },
  });

  // 5. Persist publish result on article
  await sb
    .from("articles")
    .update({
      status: input.scheduledAt ? "scheduled" : "published",
      wp_post_id: result.postId,
      published_url: result.url,
      published_at: result.publishedAt,
      updated_at: new Date().toISOString(),
    })
    .eq("id", article.id);

  await recordAuditLog(sb, {
    actor_type: "system",
    action: "article.published",
    target_type: "article",
    target_id: article.id,
    metadata: { post_id: result.postId, url: result.url },
  });

  // 6. Enqueue IndexNow + llms.txt update (Layer 8)
  if (env.INDEXNOW_QUEUE) {
    await env.INDEXNOW_QUEUE.send({
      type: "article_published",
      projectId: input.projectId,
      articleId: article.id,
      url: result.url,
    });
  }

  return { postId: result.postId, url: result.url };
}
