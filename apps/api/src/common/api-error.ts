import { HttpException } from "@nestjs/common";
import type { ApiErrorCode, FieldError } from "@daily-assistant/api-contracts";

export class ApiException extends HttpException {
  constructor(
    readonly code: ApiErrorCode,
    readonly statusCode: number,
    message: string,
    readonly fieldErrors?: FieldError[],
  ) {
    super({ code, message, statusCode, fieldErrors }, statusCode);
  }
}
