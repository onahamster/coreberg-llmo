export class WordPressError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly status?: number,
    public readonly cause?: unknown,
  ) {
    super(message);
    this.name = "WordPressError";
  }
}

export class WordPressAuthError extends WordPressError {
  constructor(message = "WordPress authentication failed", cause?: unknown) {
    super(message, "WP_AUTH_FAILED", 401, cause);
    this.name = "WordPressAuthError";
  }
}

export class WordPressRateLimitError extends WordPressError {
  constructor(public readonly retryAfter: number, cause?: unknown) {
    super(`WordPress rate limit hit, retry after ${retryAfter}s`, "WP_RATE_LIMIT", 429, cause);
    this.name = "WordPressRateLimitError";
  }
}
