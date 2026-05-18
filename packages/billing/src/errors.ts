export class UsageLimitExceededError extends Error {
  constructor(message = "Usage limit exceeded") {
    super(message);
    this.name = "UsageLimitExceededError";
  }
}
