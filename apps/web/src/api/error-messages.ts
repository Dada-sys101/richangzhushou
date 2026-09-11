const ERROR_MESSAGES: Record<string, string> = {
  ACCOUNT_NOT_ACTIVE: "账号当前不可用，请联系管理员",
  ADMIN_ACTION_REQUIRES_REASON: "请填写操作原因",
  AI_BUDGET_BLOCKED: "AI 使用额度不足，请稍后再试",
  AI_CIRCUIT_BREAKER_BLOCKED: "AI 服务暂时不可用，请稍后再试",
  AI_DISABLED: "AI 功能当前未启用",
  AI_DOMAIN_VALIDATION_ERROR: "AI 生成的内容不符合业务规则",
  AI_INPUT_VALIDATION_ERROR: "请输入有效内容后重试",
  AI_MALFORMED_OUTPUT: "AI 返回内容无法识别，请重新尝试",
  AI_OPERATION_INVALID_STATE: "该 AI 操作状态已变化，请刷新后重试",
  AI_PROPOSAL_INVALID_STATE: "该 AI 建议状态已变化，请刷新后重试",
  AI_PROPOSAL_NOT_FOUND: "未找到该 AI 建议",
  AI_PROVIDER_ERROR: "AI 服务处理失败，请稍后重试",
  AI_PROVIDER_NETWORK_ERROR: "AI 服务网络异常，请稍后重试",
  AI_PROVIDER_TIMEOUT: "AI 服务响应超时，请稍后重试",
  AI_REQUEST_NOT_FOUND: "未找到该 AI 请求",
  AI_SCHEMA_VALIDATION_ERROR: "AI 返回内容格式不正确，请重新尝试",
  ATTACHMENT_TOO_LARGE: "文件过大，请选择较小的文件",
  ATTACHMENT_TYPE_NOT_ALLOWED: "不支持该文件类型",
  CAPACITY_REACHED: "可用账号名额已满",
  CONFIRMATION_TOKEN_EXPIRED: "确认已过期，请重新操作",
  CONFIRMATION_TOKEN_INVALID: "确认信息无效，请重新操作",
  CREDENTIAL_INVALID: "设备凭证无效",
  CREDENTIAL_REVOKED: "设备凭证已撤销",
  CURSOR_INVALID: "列表位置已失效，请刷新后重试",
  DRAFT_CONFIRMATION_REQUIRED: "请确认后再执行该操作",
  DRAFT_NOT_EDITABLE: "该草稿当前不可编辑",
  DUPLICATE_RESOURCE: "已存在相同内容",
  FORBIDDEN: "没有权限执行该操作",
  IDEMPOTENCY_CONFLICT: "重复请求的内容不一致，请重新操作",
  INTERNAL_ERROR: "服务器暂时不可用，请稍后重试",
  INVALID_CREDENTIALS: "账号或密码错误",
  INVALID_CURRENT_PASSWORD: "当前密码错误",
  INVALID_STATE: "当前状态无法执行该操作",
  MUTATION_BATCH_TOO_LARGE: "一次提交的内容过多，请分批操作",
  MUTATION_UNSUPPORTED: "暂不支持该同步操作",
  PASSWORD_CHANGE_REQUIRED: "首次登录需要先修改密码",
  RATE_LIMITED: "操作过于频繁，请稍后重试",
  REFRESH_TOKEN_INVALID: "登录状态已失效，请重新登录",
  REFRESH_TOKEN_REQUIRED: "请重新登录",
  RESOURCE_NOT_FOUND: "未找到相关内容",
  SETTING_LOWER_THAN_USAGE: "设置值不能低于当前使用量",
  UNAUTHORIZED: "登录状态已过期，请重新登录",
  UPLOAD_INTENT_EXPIRED: "上传已过期，请重新选择文件",
  UPLOAD_TOKEN_INVALID: "上传凭证无效，请重新上传",
  VALIDATION_ERROR: "输入内容不符合要求，请检查后重试",
  VERSION_CONFLICT: "内容已在其他位置更新，请刷新后确认",
};

export function localizedApiErrorMessage(code: string, status: number): string {
  if (ERROR_MESSAGES[code]) return ERROR_MESSAGES[code];
  if (status === 401) return "登录状态已过期，请重新登录";
  if (status === 403) return "没有权限执行该操作";
  if (status === 404) return "未找到相关内容";
  if (status === 429) return "操作过于频繁，请稍后重试";
  if (status >= 500) return "服务器暂时不可用，请稍后重试";
  return "操作失败，请稍后重试";
}

export function localizedFieldErrors(
  fieldErrors?: Array<{ field: string; message: string }>,
) {
  return fieldErrors?.map(({ field }) => ({
    field,
    message: "输入内容不符合要求",
  }));
}
