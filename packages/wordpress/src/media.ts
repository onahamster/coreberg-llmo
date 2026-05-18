import type { WordPressClient } from "./client";
import type { WpMediaResponse } from "./types";

export interface UploadMediaInput {
  imageUrl: string;       // Supabase Storage public URL
  filename: string;       // e.g. "article-123-hero.png"
  altText?: string;
  caption?: string;
  mimeType?: string;
}

export async function uploadMedia(
  client: WordPressClient,
  input: UploadMediaInput,
): Promise<WpMediaResponse> {
  // 1. Fetch image bytes
  const res = await fetch(input.imageUrl);
  if (!res.ok) throw new Error(`Failed to fetch image: ${res.status}`);
  const buf = await res.arrayBuffer();
  const mime = input.mimeType ?? res.headers.get("Content-Type") ?? "image/png";

  // 2. POST to /media (binary upload with Content-Disposition)
  const created = await client.request<WpMediaResponse>({
    method: "POST",
    path: "/media",
    headers: {
      "Content-Type": mime,
      "Content-Disposition": `attachment; filename="${input.filename}"`,
    },
    body: buf,
  });

  // 3. Update alt_text / caption if provided
  if (input.altText || input.caption) {
    await client.request<WpMediaResponse>({
      method: "POST",
      path: `/media/${created.id}`,
      json: {
        alt_text: input.altText,
        caption: input.caption,
      },
    });
  }
  return created;
}
