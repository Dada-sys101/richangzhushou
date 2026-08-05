import { CanActivate, ExecutionContext, Injectable } from "@nestjs/common";

import { ApiException } from "../common/api-error.js";
import type { AuthenticatedRequest } from "./auth.types.js";

@Injectable()
export class UserOnlyGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    if (!request.user || request.user.role !== "USER") {
      throw new ApiException(
        "FORBIDDEN",
        403,
        "User content endpoints require a regular user account",
      );
    }
    return true;
  }
}
