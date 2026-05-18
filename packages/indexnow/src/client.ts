const ENDPOINT = "https://api.indexnow.org/indexnow";
const MAX_URLS_PER_REQUEST = 1000;

export interface IndexNowSubmitInput {
  host: string;        // e.g. "example.com"
  key: string;
  keyLocation?: string;
  urls: string[];
}

export interface IndexNowResult {
  submitted: number;
  batches: { count: number; status: number; ok: boolean }[];
}

export async function submitToIndexNow(
  input: IndexNowSubmitInput,
): Promise<IndexNowResult> {
  const batches: IndexNowResult["batches"] = [];
  let submitted = 0;

  for (let i = 0; i < input.urls.length; i += MAX_URLS_PER_REQUEST) {
    const chunk = input.urls.slice(i, i + MAX_URLS_PER_REQUEST);
    const body = {
      host: input.host,
      key: input.key,
      keyLocation: input.keyLocation,
      urlList: chunk,
    };
    const res = await fetch(ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json; charset=utf-8",
      },
      body: JSON.stringify(body),
    });
    // 200 = OK, 202 = Accepted, 422 = invalid URLs (partial), 429 = throttled
    batches.push({ count: chunk.length, status: res.status, ok: res.status < 400 });
    if (res.status < 400) submitted += chunk.length;
    if (res.status === 429) {
      // back off and stop further batches; caller can retry
      break;
    }
  }
  return { submitted, batches };
}
