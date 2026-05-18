import {
  WordPressAuthError,
  WordPressError,
  WordPressRateLimitError,
} from "./errors";
import type { WpConnection } from "./types";

export interface WpRequestOptions {
  method?: "GET" | "POST" | "PUT" | "DELETE" | "PATCH";
  path: string;
  query?: Record<string, string | number | undefined>;
  json?: unknown;
  body?: BodyInit;
  headers?: Record<string, string>;
  timeoutMs?: number;
  maxRetries?: number;
}

export class WordPressClient {
  private readonly authHeader: string;
  private readonly baseUrl: string;

  constructor(private readonly conn: WpConnection) {
    const token = btoa(`${conn.username}:${conn.appPassword}`);
    this.authHeader = `Basic ${token}`;
    this.baseUrl = conn.siteUrl.replace(/\/$/, "") + "/wp-json/wp/v2";
  }

  async request<T>(opts: WpRequestOptions): Promise<T> {
    const url = new URL(this.baseUrl + opts.path);
    if (opts.query) {
      for (const [k, v] of Object.entries(opts.query)) {
        if (v !== undefined) url.searchParams.set(k, String(v));
      }
    }

    const headers: Record<string, string> = {
      Authorization: this.authHeader,
      Accept: "application/json",
      ...(opts.headers ?? {}),
    };
    let body: BodyInit | undefined = opts.body;
    if (opts.json !== undefined) {
      body = JSON.stringify(opts.json);
      headers["Content-Type"] = "application/json";
    }

    const maxRetries = opts.maxRetries ?? 4;
    let attempt = 0;
    let lastError: unknown;

    while (attempt <= maxRetries) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), opts.timeoutMs ?? 30_000);
      try {
        const res = await fetch(url.toString(), {
          method: opts.method ?? "GET",
          headers,
          body,
          signal: controller.signal,
        });
        clearTimeout(timeout);

        if (res.status === 401 || res.status === 403) {
          throw new WordPressAuthError(`Auth failed (${res.status})`);
        }
        if (res.status === 429) {
          const retryAfter = Number(res.headers.get("Retry-After") ?? "5");
          if (attempt < maxRetries) {
            await sleep(retryAfter * 1000);
            attempt += 1;
            continue;
          }
          throw new WordPressRateLimitError(retryAfter);
        }
        if (res.status >= 500 && attempt < maxRetries) {
          await sleep(backoffMs(attempt));
          attempt += 1;
          continue;
        }
        if (!res.ok) {
          const text = await res.text().catch(() => "");
          throw new WordPressError(
            `WP ${res.status}: ${text.slice(0, 500)}`,
            "WP_HTTP_ERROR",
            res.status,
          );
        }
        // 204 No Content
        if (res.status === 204) return undefined as T;
        return (await res.json()) as T;
      } catch (err) {
        clearTimeout(timeout);
        lastError = err;
        if (err instanceof WordPressError) throw err;
        if (attempt >= maxRetries) break;
        await sleep(backoffMs(attempt));
        attempt += 1;
      }
    }
    throw new WordPressError(
      `WP request failed after ${maxRetries} retries`,
      "WP_NETWORK_ERROR",
      undefined,
      lastError,
    );
  }

  async verify(): Promise<{ ok: true; user: { id: number; name: string } }> {
    // /users/me requires authentication; useful for connection test
    const user = await this.request<{ id: number; name: string }>({
      path: "/users/me",
      query: { context: "edit" },
    });
    return { ok: true, user };
  }
}

function backoffMs(attempt: number): number {
  // 500ms, 1s, 2s, 4s + jitter
  const base = 500 * 2 ** attempt;
  return base + Math.floor(Math.random() * 250);
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
