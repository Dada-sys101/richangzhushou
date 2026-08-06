export class NotificationUnavailableError extends Error {
  constructor(message = "Notification provider is temporarily unavailable") {
    super(message);
    this.name = "NotificationUnavailableError";
  }
}

export interface StorageAdapter {
  put(key: string, data: Buffer, mimeType: string): Promise<void>;
  get(key: string): Promise<Buffer>;
  delete(key: string): Promise<void>;
}

export interface NotificationMessage {
  body?: string;
  scheduledAt: Date;
  title: string;
  userId: string;
}

export interface NotificationAdapter {
  send(message: NotificationMessage): Promise<{ delivered: boolean }>;
}

export const STORAGE_ADAPTER = Symbol("STORAGE_ADAPTER");
export const NOTIFICATION_ADAPTER = Symbol("NOTIFICATION_ADAPTER");
