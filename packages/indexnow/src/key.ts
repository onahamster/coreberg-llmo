/**
 * IndexNow requires a key file hosted at <host>/<key>.txt containing only the key.
 * We generate a per-project key (32 hex chars), store it in projects.indexnow_key,
 * and expose it via a Worker route that serves <project-host>/<key>.txt OR via a
 * customer-installed file on their WordPress (preferred).
 *
 * Per spec: key must be 8-128 hex chars.
 */
export function generateIndexNowKey(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

export function indexNowKeyLocation(siteUrl: string, key: string): string {
  return new URL(`/${key}.txt`, siteUrl).toString();
}
