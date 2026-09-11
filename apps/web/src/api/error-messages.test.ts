import { describe, expect, it } from "vitest";

import {
  localizedApiErrorMessage,
  localizedFieldErrors,
} from "./error-messages";

describe("localizedApiErrorMessage", () => {
  it("maps server and authentication failures to Chinese", () => {
    expect(localizedApiErrorMessage("INTERNAL_ERROR", 500)).toBe(
      "服务器暂时不可用，请稍后重试",
    );
    expect(localizedApiErrorMessage("INVALID_CREDENTIALS", 401)).toBe(
      "账号或密码错误",
    );
    expect(localizedApiErrorMessage("UNKNOWN_ERROR", 503)).toBe(
      "服务器暂时不可用，请稍后重试",
    );
  });

  it("does not expose server field-error text", () => {
    expect(
      localizedFieldErrors([{ field: "password", message: "must be longer" }]),
    ).toEqual([{ field: "password", message: "输入内容不符合要求" }]);
  });
});
