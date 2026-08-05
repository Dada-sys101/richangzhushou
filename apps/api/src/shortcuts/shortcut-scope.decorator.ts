import { SetMetadata } from "@nestjs/common";

export const SHORTCUT_SCOPE_KEY = "shortcutScope";

export function RequireShortcutScope(scope: string): MethodDecorator {
  return SetMetadata(SHORTCUT_SCOPE_KEY, scope);
}
