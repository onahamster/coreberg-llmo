export interface ExtractorResult {
  text: string;
  citations?: string[];
}

export interface CitationHit {
  url: string;
  domain: string;
  kind: "native" | "ai_overview" | "suggested";
  rank: number;
}

export function extractCitations(result: ExtractorResult, targetDomains: string[]) {
  const hits: CitationHit[] = [];
  const foundUrls = new Set<string>();

  // Helper to normalize and add URL
  const addUrl = (urlStr: string, idx: number) => {
    try {
      const url = new URL(urlStr);
      const normalized = `${url.hostname}${url.pathname}`;
      if (foundUrls.has(normalized)) return;
      foundUrls.add(normalized);

      const matchedDomain = targetDomains.find((d) => url.hostname === d || url.hostname.endsWith(`.${d}`));
      if (matchedDomain) {
        hits.push({
          url: urlStr,
          domain: matchedDomain,
          kind: "native",
          rank: idx + 1,
        });
      }
    } catch (e) {
      // Ignore invalid URLs
    }
  };

  // 1. Scan the citations array if available
  if (result.citations) {
    result.citations.forEach((c, idx) => addUrl(c, idx));
  }

  // 2. Scan URLs in text body using regex
  const urlRegex = /https?:\/\/[^\s\)\],]+/g;
  const matches = result.text.match(urlRegex) ?? [];
  matches.forEach((m, idx) => addUrl(m, idx));

  return {
    hits,
    shouldJudge: hits.length > 0,
  };
}
