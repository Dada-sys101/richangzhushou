import type { TransactionType } from "@daily-assistant/api-contracts";

import { ApiException } from "../common/api-error.js";

const SHANGHAI_UTC_OFFSET_MS = 8 * 60 * 60 * 1000;
const MONEY_TOKEN_PATTERN = /(\d{1,3}(?:,\d{3})*|\d+)(?:\.(\d{1,2}))?/;

export interface ParsedTransactionDraft {
  amount: string;
  confidence: Record<string, number>;
  currency: string;
  merchant: string | null;
  note: string;
  occurredAt: string;
  type: TransactionType;
}

export function parseTransactionText(
  rawText: string,
  now = new Date(),
): ParsedTransactionDraft {
  const text = rawText.trim();
  if (!text) {
    throw new ApiException("VALIDATION_ERROR", 400, "Text is required", [
      { field: "text", message: "请输入要解析的内容" },
    ]);
  }

  const amountMatch = findAmount(text);
  if (!amountMatch) {
    throw new ApiException("VALIDATION_ERROR", 400, "金额无法识别", [
      { field: "text", message: "未能识别金额，请手动填写" },
    ]);
  }

  return {
    amount: normalizeAmount(amountMatch),
    confidence: {
      amount: 1,
      merchant: extractMerchant(text) ? 0.7 : 0,
      note: 0.9,
      occurredAt: 1,
      type: 1,
    },
    currency: "CNY",
    merchant: extractMerchant(text),
    note: text.length > 500 ? `${text.slice(0, 497)}...` : text,
    occurredAt: detectTime(text, now).toISOString(),
    type: detectType(text),
  };
}

function findAmount(text: string): string | null {
  const cleaned = text
    .replace(/\d{4}-\d{1,2}-\d{1,2}/g, " ")
    .replace(/\d{1,2}月\d{1,2}日/g, " ")
    .replace(/\b\d{1,2}:\d{2}\b/g, " ")
    .replace(/\b\d{4}\b/g, " ");
  const match = MONEY_TOKEN_PATTERN.exec(cleaned);
  if (!match) {
    return null;
  }
  return match[0];
}

function normalizeAmount(raw: string): string {
  const compact = raw.replace(/,/g, "");
  const [integer, fraction] = compact.split(".");
  if (fraction === undefined) {
    return `${integer}.00`;
  }
  if (fraction.length === 1) {
    return `${integer}.${fraction}0`;
  }
  return `${integer}.${fraction}`;
}

function detectType(text: string): TransactionType {
  if (/退款|退回|退票/.test(text)) {
    return "REFUND";
  }
  if (/收入|入账|收到|工资/.test(text)) {
    return "INCOME";
  }
  return "EXPENSE";
}

function detectTime(text: string, now: Date): Date {
  const shifted = new Date(now.getTime() + SHANGHAI_UTC_OFFSET_MS);
  let year = shifted.getUTCFullYear();
  let month = shifted.getUTCMonth();
  let day = shifted.getUTCDate();
  if (/昨天/.test(text)) {
    const yesterday = new Date(
      Date.UTC(year, month, day - 1) + SHANGHAI_UTC_OFFSET_MS,
    );
    year = yesterday.getUTCFullYear();
    month = yesterday.getUTCMonth();
    day = yesterday.getUTCDate();
  }

  const dateMatch = /(\d{4})-(\d{1,2})-(\d{1,2})/.exec(text);
  if (dateMatch) {
    year = Number(dateMatch[1]);
    month = Number(dateMatch[2]) - 1;
    day = Number(dateMatch[3]);
  }

  let hour = 0;
  let minute = 0;
  const timeMatch = /(\d{1,2}):(\d{2})/.exec(text);
  if (timeMatch) {
    hour = Number(timeMatch[1]);
    minute = Number(timeMatch[2]);
  }
  return new Date(
    Date.UTC(year, month, day, hour, minute) - SHANGHAI_UTC_OFFSET_MS,
  );
}

function extractMerchant(text: string): string | null {
  const cleaned = text
    .replace(/\d{4}-\d{1,2}-\d{1,2}/g, " ")
    .replace(/\d{1,2}月\d{1,2}日/g, " ")
    .replace(/\b\d{1,2}:\d{2}\b/g, " ")
    .replace(/[¥￥元块钱]/g, " ")
    .replace(/[\d,]+(?:\.\d{1,2})?/g, " ")
    .replace(
      /(?:花了|消费|支付|支出|记账|记一笔|收入|入账|收到|退款|退回|今天|昨天)/g,
      " ",
    )
    .trim();
  const token = cleaned.split(/\s+/).find((part) => part.length > 0);
  if (!token || token.length > 40) {
    return null;
  }
  return token;
}
