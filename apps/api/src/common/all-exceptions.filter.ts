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
      message: "Internal server error",
      requestId,
    };

    if (exception instanceof ApiException) {
      status = exception.statusCode;
      body = {
        code: exception.code,
        message: exception.message,
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
          ? "Request validation failed"
          : String(
              (payload as { message?: unknown }).message ??
                exception.message ??
                "Request failed",
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
                message: String(item),
              }))
            : undefined,
        };
      }
      status = exception.getStatus();
    }

    response.status(status).json(body);
  }
}
