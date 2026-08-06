// @vitest-environment jsdom
import { mount } from "@vue/test-utils";
import { RouterLinkStub } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useAuthStore } from "../stores/auth";
import { useSyncStore } from "../stores/sync";
import SyncBadge from "./SyncBadge.vue";

describe("SyncBadge", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    const auth = useAuthStore();
    auth.$patch({ accessToken: "token" });
  });

  function mountBadge() {
    return mount(SyncBadge, {
      global: { stubs: { RouterLink: RouterLinkStub } },
    });
  }

  it("labels a synced state as 已同步", () => {
    const sync = useSyncStore();
    sync.$patch({ status: "SYNCED", syncing: false });
    expect(mountBadge().text()).toContain("已同步");
  });

  it("labels pending and in-flight states as 同步中", () => {
    const sync = useSyncStore();
    sync.$patch({ status: "PENDING_SYNC", syncing: false });
    expect(mountBadge().text()).toContain("同步中");
    sync.$patch({ status: "SYNCED", syncing: true });
    expect(mountBadge().text()).toContain("同步中");
  });

  it("labels a failed state as 同步失败 and retries on demand", async () => {
    const sync = useSyncStore();
    sync.$patch({ status: "SYNC_FAILED", syncing: false });
    const retry = vi.spyOn(sync, "retry").mockResolvedValue(undefined);
    const wrapper = mountBadge();
    expect(wrapper.text()).toContain("同步失败");
    await wrapper.find(".retry-button").trigger("click");
    expect(retry).toHaveBeenCalledOnce();
  });
});
