// @vitest-environment jsdom

import { mount } from "@vue/test-utils";
import { describe, expect, it } from "vitest";

import ErrorState from "./ErrorState.vue";

describe("ErrorState", () => {
  it("uses the default title, alert semantics and text description", () => {
    const description = "网络暂时不可用。<script>不会执行</script>";
    const wrapper = mount(ErrorState, { props: { description } });

    expect(wrapper.find('[role="alert"]').exists()).toBe(true);
    expect(wrapper.get("h2").text()).toBe("暂时无法加载");
    expect(wrapper.get("p").text()).toBe(description);
    expect(wrapper.find("script").exists()).toBe(false);
  });

  it("supports a custom title and has no retry action by default", () => {
    const wrapper = mount(ErrorState, {
      props: { description: "读取失败", title: "无法读取记录" },
    });

    expect(wrapper.get("h2").text()).toBe("无法读取记录");
    expect(wrapper.find("button").exists()).toBe(false);
  });

  it("renders an optional retry action and emits once", async () => {
    const wrapper = mount(ErrorState, {
      props: { actionLabel: "重试", description: "读取失败" },
    });

    const button = wrapper.get("button");
    expect(button.text()).toBe("重试");
    await button.trigger("click");
    await button.trigger("click");
    expect(wrapper.emitted("retry")).toHaveLength(1);
  });
});
