import type { WordPressClient } from "./client";
import { uploadMedia } from "./media";
import {
  type WpPostPayload,
  type WpPostResponse,
  wpPostResponseSchema,
} from "./types";

export interface PublishArticleInput {
  title: string;
  contentHtml: string;       // body HTML
  jsonLd?: object;           // schema.org JSON-LD, will be appended as <script>
  slug: string;
  excerpt?: string;
  status?: "publish" | "draft" | "future";
  scheduledAt?: Date;
  categoryIds?: number[];
  tagIds?: number[];
  featuredImage?: {
    imageUrl: string;
    filename: string;
    altText?: string;
  };
  seo?: {
    metaTitle?: string;
    metaDescription?: string;
    canonicalUrl?: string;
  };
}

export interface PublishArticleResult {
  postId: number;
  url: string;
  slug: string;
  publishedAt: string;
  featuredMediaId?: number;
}

export async function publishArticle(
  client: WordPressClient,
  input: PublishArticleInput,
): Promise<PublishArticleResult> {
  let featuredMediaId: number | undefined;
  if (input.featuredImage) {
    const media = await uploadMedia(client, {
      imageUrl: input.featuredImage.imageUrl,
      filename: input.featuredImage.filename,
      altText: input.featuredImage.altText,
    });
    featuredMediaId = media.id;
  }

  // Append JSON-LD inside content (most WP setups strip <script> from REST;
  // we recommend a small mu-plugin on the customer's WP that whitelists
  // application/ld+json. Fallback: store JSON-LD in post_meta `_coreberg_jsonld`.)
  const content = input.jsonLd
    ? `${input.contentHtml}\n<script type="application/ld+json">${JSON.stringify(
        input.jsonLd,
      )}</script>`
    : input.contentHtml;

  const meta: Record<string, unknown> = {};
  if (input.jsonLd) meta._coreberg_jsonld = JSON.stringify(input.jsonLd);
  if (input.seo?.metaTitle) meta._yoast_wpseo_title = input.seo.metaTitle;
  if (input.seo?.metaDescription) meta._yoast_wpseo_metadesc = input.seo.metaDescription;
  if (input.seo?.canonicalUrl) meta._yoast_wpseo_canonical = input.seo.canonicalUrl;

  const payload: WpPostPayload = {
    title: input.title,
    content,
    excerpt: input.excerpt,
    slug: input.slug,
    status: input.status ?? "publish",
    categories: input.categoryIds,
    tags: input.tagIds,
    featured_media: featuredMediaId,
    meta: Object.keys(meta).length > 0 ? meta : undefined,
    date_gmt: input.scheduledAt?.toISOString(),
  };

  const raw = await client.request<unknown>({
    method: "POST",
    path: "/posts",
    json: payload,
  });
  const post: WpPostResponse = wpPostResponseSchema.parse(raw);

  return {
    postId: post.id,
    url: post.link,
    slug: post.slug,
    publishedAt: post.date_gmt,
    featuredMediaId,
  };
}

export async function updatePublishedArticle(
  client: WordPressClient,
  postId: number,
  input: Partial<PublishArticleInput>,
): Promise<PublishArticleResult> {
  const content =
    input.contentHtml && input.jsonLd
      ? `${input.contentHtml}\n<script type="application/ld+json">${JSON.stringify(
          input.jsonLd,
        )}</script>`
      : input.contentHtml;
  const raw = await client.request<unknown>({
    method: "POST",
    path: `/posts/${postId}`,
    json: {
      title: input.title,
      content,
      excerpt: input.excerpt,
      slug: input.slug,
    },
  });
  const post = wpPostResponseSchema.parse(raw);
  return {
    postId: post.id,
    url: post.link,
    slug: post.slug,
    publishedAt: post.modified_gmt,
  };
}
