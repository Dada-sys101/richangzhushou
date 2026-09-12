import { reactive } from "vue";

export interface ConfirmOptions {
  cancelLabel?: string;
  confirmLabel?: string;
  description: string;
  destructive?: boolean;
  title?: string;
}

interface ConfirmState extends Required<Omit<ConfirmOptions, "destructive">> {
  destructive: boolean;
  open: boolean;
}

export const appConfirmState = reactive<ConfirmState>({
  cancelLabel: "取消",
  confirmLabel: "确认",
  description: "",
  destructive: false,
  open: false,
  title: "请确认",
});

let settle: ((confirmed: boolean) => void) | null = null;

export function requestAppConfirm(options: ConfirmOptions): Promise<boolean> {
  settle?.(false);
  Object.assign(appConfirmState, {
    cancelLabel: options.cancelLabel ?? "取消",
    confirmLabel: options.confirmLabel ?? "确认",
    description: options.description,
    destructive: options.destructive ?? false,
    open: true,
    title: options.title ?? "请确认",
  });
  return new Promise<boolean>((resolve) => {
    settle = resolve;
  });
}

export function resolveAppConfirm(confirmed: boolean) {
  if (!appConfirmState.open) return;
  appConfirmState.open = false;
  const current = settle;
  settle = null;
  current?.(confirmed);
}
