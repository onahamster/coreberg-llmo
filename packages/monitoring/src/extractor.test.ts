import { describe, it, expect } from 'vitest';
import { extractCitations } from './extractor';

describe('extractCitations', () => {
  it('extracts URLs and dedupes by host+path', () => {
    const r = extractCitations(
      { text: 'See https://example.com/a and https://example.com/a?utm=1 plus https://other.com', citations: [] },
      ['example.com'],
    );
    expect(r.hits.find(h => h.domain === 'example.com')?.rank).toBe(1);
    expect(r.hits.filter(h => h.domain === 'example.com')).toHaveLength(1);
  });

  it('returns empty when no target domains match', () => {
    const r = extractCitations({ text: 'https://other.com', citations: [] }, ['example.com']);
    expect(r.hits).toEqual([]);
    expect(r.shouldJudge).toBe(false);
  });
});
