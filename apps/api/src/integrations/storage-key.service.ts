import { Injectable } from "@nestjs/common";

const LEGACY_ATTACHMENT_PREFIX = "attachments/";

@Injectable()
export class StorageKeyService {
  /**
   * Canonical key for newly uploaded attachments. Existing rows keep their
   * legacy `attachments/{userId}/...` keys; get/delete always use the
   * persisted objectKey so both formats remain readable and deletable.
   */
  generateAttachmentKey(userId: string, fileId: string): string {
    assertSafeSegment(userId, "userId");
    assertSafeSegment(fileId, "fileId");
    return `users/${userId}/attachments/${fileId}`;
  }

  isLegacyAttachmentKey(key: string): boolean {
    return key.startsWith(LEGACY_ATTACHMENT_PREFIX);
  }
}

function assertSafeSegment(value: string, label: string): void {
  if (
    value.length === 0 ||
    value === "." ||
    value === ".." ||
    value.includes("/") ||
    value.includes("\\") ||
    hasControlCharacter(value)
  ) {
    throw new Error(`Unsafe storage key segment: ${label}`);
  }
}

function hasControlCharacter(value: string): boolean {
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    if (code < 0x20 || code === 0x7f) {
      return true;
    }
  }
  return false;
}
