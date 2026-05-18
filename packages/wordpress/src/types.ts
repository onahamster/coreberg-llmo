import { z } from "zod";

export const wpPostStatusSchema = z.enum(["publish", "draft", "future", "private", "pending"]);
export type WpPostStatus = z.infer<typeof wpPostStatusSchema>;

export const wpPostPayloadSchema = z.object({
  title: z.string().min(1),
  content: z.string().min(1),
  excerpt: z.string().optional(),
  slug: z.string().optional(),
  status: wpPostStatusSchema.default("publish"),
  categories: z.array(z.number().int()).optional(),
  tags: z.array(z.number().int()).optional(),
  featured_media: z.number().int().optional(),
  meta: z.record(z.unknown()).optional(),
  date_gmt: z.string().optional(), // ISO 8601, for scheduled posts
});
export type WpPostPayload = z.infer<typeof wpPostPayloadSchema>;

export const wpPostResponseSchema = z.object({
  id: z.number().int(),
  link: z.string().url(),
  slug: z.string(),
  status: wpPostStatusSchema,
  date_gmt: z.string(),
  modified_gmt: z.string(),
});
export type WpPostResponse = z.infer<typeof wpPostResponseSchema>;

export const wpMediaResponseSchema = z.object({
  id: z.number().int(),
  source_url: z.string().url(),
  media_type: z.string(),
  mime_type: z.string(),
});
export type WpMediaResponse = z.infer<typeof wpMediaResponseSchema>;

export const wpConnectionSchema = z.object({
  siteUrl: z.string().url(),
  username: z.string().min(1),
  appPassword: z.string().min(1), // Application Password (decoded)
});
export type WpConnection = z.infer<typeof wpConnectionSchema>;
