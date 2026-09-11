import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from "@nestjs/common";
import type { Response } from "express";

import type { RequestWithId } from "./request-id.middleware.js";
import { ApiException } from "./api-error.js";

interface ErrorBody {
  code: string;
  message: string;
  requestId: string;
  fieldErrors?: unknown;
}

const API_ERROR_MESSAGES: Record<string, string> = {
  ACCOUNT_NOT_ACTIVE: "账号当前不可用，请联系管理员",
  CAPACITY_REACHED: "可用账号名额已满",
  DUPLICATE_RESOURCE: "已存在相同内容",
  FORBIDDEN: "没有权限执行该操作",
  INTERNAL_ERROR: "服务器暂时不可用，请稍后重试",
  INVALID_CREDENTIALS: "账号或密码错误",
  INVALID_CURRENT_PASSWORD: "当前密码错误",
  INVALID_STATE: "当前状态无法执行该操作",
  PASSWORD_CHANGE_REQUIRED: "首次登录需要先修改密码",
  RATE_LIMITED: "操作过于频繁，请稍后重试",
  REFRESH_TOKEN_INVALID: "登录状态已失效，请重新登录",
  REFRESH_TOKEN_REQUIRED: "请重新登录",
  RESOURCE_NOT_FOUND: "未找到相关内容",
  SETTING_LOWER_THAN_USAGE: "设置值不能低于当前使用量",
  UNAUTHORIZED: "登录状态已过期，请重新登录",
  VALIDATION_ERROR: "输入内容不符合要求，请检查后重试",
  VERSION_CONFLICT: "内容已在其他位置更新，请刷新后确认",
};

function localizedMessage(code: string, status: number): string {
  if (API_ERROR_MESSAGES[code]) return API_ERROR_MESSAGES[code];
  if (status === 401) return "登录状态已过期，请重新登录";
  if (status === 403) return "没有权限执行该操作";
  if (status === 404) return "未找到相关内容";
  if (status === 429) return "操作过于频繁，请稍后重试";
  if (status >= 500) return "服务器暂时不可用，请稍后重试";
  return "操作失败，请稍后重试";
}

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const context = host.switchToHttp();
    const response = context.getResponse<Response>();
    const request = context.getRequest<RequestWithId>();
    const requestId =
      request.requestId ?? `req_${Math.random().toString(36).slice(2)}`;

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let body: ErrorBody = {
      code: "INTERNAL_ERROR",
      message: "服务器内部错误，请稍后重试",
      requestId,
    };

    if (exception instanceof ApiException) {
      status = exception.statusCode;
      body = {
        code: exception.code,
        message: localizedMessage(exception.code, exception.statusCode),
        requestId,
        fieldErrors: exception.fieldErrors,
      };
    } else if (exception instanceof HttpException) {
      const payload = exception.getResponse();
      if (
        typeof payload === "object" &&
        payload !== null &&
        "code" in payload &&
        typeof (payload as { code: string }).code === "string"
      ) {
        body = {
          ...(payload as ErrorBody),
          requestId,
        };
      } else {
        const message = Array.isArray(
          (payload as { message?: unknown }).message,
        )
          ? "请求内容校验失败"
          : String(
              (payload as { message?: unknown }).message ??
                exception.message ??
                "请求失败，请稍后重试",
            );
        body = {
          code: "VALIDATION_ERROR",
          message,
          requestId,
          fieldErrors: Array.isArray((payload as { message?: unknown }).message)
            ? (
                payload as { message: Array<{ property?: string }> }
              ).message.map((item) => ({
                field: String(item?.property ?? "body"),
                message: "输入内容不符合要求",
              }))
            : undefined,
        };
      }
      status = exception.getStatus();
    }

    response.status(status).json(body);
  }
}
