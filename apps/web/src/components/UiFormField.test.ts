// @vitest-environment jsdom

import { mount } from "@vue/test-utils";
import { h } from "vue";
import { describe, expect, it } from "vitest";

import UiFormField from "./UiFormField.vue";

function fieldWithControl(
  props: Record<string, unknown> = {},
  slots: Record<string, string> = {},
) {
  return mount(UiFormField, {
    props: { label: "密码", ...props },
    slots: {
      default: ({
        controlId,
        describedBy,
        required,
      }: {
        controlId: string;
        describedBy?: string;
        required: boolean;
      }) =>
        h("input", {
          id: controlId,
          "aria-describedby": describedBy,
          "aria-required": required,
          required,
        }),
      ...slots,
    },
  });
}

describe("UiFormField", () => {
  it("uses an explicit control id and exposes required slot props", () => {
    const wrapper = fieldWithControl({
      for: "password-control",
      required: true,
    });

    expect(wrapper.get("label").attributes("for")).toBe("password-control");
    expect(wrapper.get("input").attributes()).toMatchObject({
      id: "password-control",
      required: "",
      "aria-required": "true",
    });
    expect(
      wrapper.get(".ui-form-field__required").attributes("aria-hidden"),
    ).toBe("true");
  });

  it("generates unique ids for multiple instances", () => {
    const wrapper = mount({
      components: { UiFormField },
      template: `
        <UiFormField label="第一个">
          <template #default="{ controlId }"><input :id="controlId" /></template>
        </UiFormField>
        <UiFormField label="第二个">
          <template #default="{ controlId }"><input :id="controlId" /></template>
        </UiFormField>
      `,
    });

    const ids = wrapper.findAll("input").map((input) => input.attributes("id"));
    const labels = wrapper.findAll("label");
    expect(ids).toHaveLength(2);
    expect(new Set(ids).size).toBe(2);
    expect(labels[0]!.attributes("for")).toBe(ids[0]);
    expect(labels[1]!.attributes("for")).toBe(ids[1]);
  });

  it("renders default and custom labels and help with the help id", () => {
    const defaultHelp = fieldWithControl({
      for: "password-control",
      help: "默认帮助",
    });
    expect(defaultHelp.get("label").text()).toContain("密码");
    expect(defaultHelp.get(".ui-form-field__help").text()).toBe("默认帮助");
    expect(defaultHelp.get("input").attributes("aria-describedby")).toBe(
      "password-control-help",
    );

    const custom = fieldWithControl(
      { for: "custom-control", required: true, help: "帮助参数" },
      {
        label: "<span class=custom-label>自定义标签</span>",
        help: "<strong>自定义帮助</strong>",
      },
    );
    expect(custom.get("label").text()).toContain("自定义标签");
    expect(custom.get(".ui-form-field__help").text()).toBe("自定义帮助");
    expect(custom.get(".ui-form-field__help").attributes("id")).toBe(
      "custom-control-help",
    );
  });

  it("gives error precedence over help and omits empty descriptions", () => {
    const error = fieldWithControl({
      for: "error-control",
      help: "不会显示",
      error: "密码不正确",
    });
    expect(error.find(".ui-form-field__help").exists()).toBe(false);
    expect(error.get(".ui-form-field__error").attributes()).toMatchObject({
      id: "error-control-error",
      role: "alert",
    });
    expect(error.get("input").attributes("aria-describedby")).toBe(
      "error-control-error",
    );

    const empty = fieldWithControl({ for: "empty-control" });
    expect(empty.get("input").attributes("aria-describedby")).toBeUndefined();
    expect(empty.find(".ui-form-field__help").exists()).toBe(false);
    expect(empty.find(".ui-form-field__error").exists()).toBe(false);
  });
});
