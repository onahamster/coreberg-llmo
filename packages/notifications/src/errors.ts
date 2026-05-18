export class NotificationError extends Error {
  constructor(message: string, public code: string, public cause?: unknown) {
    super(message);
    this.name = "NotificationError";
  }
}

export class TransientNotificationError extends NotificationError {
  constructor(message: string, cause?: unknown) {
    super(message, "TRANSIENT", cause);
    this.name = "TransientNotificationError";
  }
}
