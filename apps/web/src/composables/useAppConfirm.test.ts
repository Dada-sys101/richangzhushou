import { afterEach, describe, expect, it } from "vitest";

import {
  appConfirmState,
  requestAppConfirm,
  resolveAppConfirm,
} from "./useAppConfirm";

afterEach(() => {
  resolveAppConfirm(false);
});

describe("app confirmation service", () => {
  it("resolves the pending confirmation", async () => {
    const result = requestAppConfirm({
      description: "确定删除吗？",
      destructive: true,
      title: "删除？",
    });
    expect(appConfirmState.open).toBe(true);
    expect(appConfirmState.confirmLabel).toBe("确认");
    resolveAppConfirm(true);
    await expect(result).resolves.toBe(true);
    expect(appConfirmState.open).toBe(false);
  });

  it("cancels an earlier request when a new one replaces it", async () => {
    const first = requestAppConfirm({ description: "第一项" });
    const second = requestAppConfirm({ description: "第二项" });
    await expect(first).resolves.toBe(false);
    expect(appConfirmState.description).toBe("第二项");
    resolveAppConfirm(false);
    await expect(second).resolves.toBe(false);
  });
});
