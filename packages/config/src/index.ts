export const API_BASE_PATH = "/api/v1" as const;
export const BUSINESS_TIME_ZONE = "Asia/Shanghai" as const;
export const DEFAULT_CURRENCY = "CNY" as const;

/** V1 正式产品显示名（OPEN-001/OPEN-011：品牌显示名与技术标识分离）。 */
export const PRODUCT = {
  nameZh: "日常助手",
  nameEn: "Daily Assistant",
  displayName: "日常助手 / Daily Assistant",
  adminNameZh: "日常助手管理端",
  adminNameEn: "Daily Assistant Admin",
} as const;
