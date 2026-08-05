import { CanActivate, ExecutionContext, Injectable } from "@nestjs/common";
import type { Observable } from "rxjs";

import { ApiException } from "../common/api-error.js";
import type { AuthenticatedRequest } from "./auth.types.js";

@Injectable()
export class AdminGuard implements CanActivate {
  canActivate(
    context: ExecutionContext,
  ): boolean | Promise<boolean> | Observable<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    if (!request.user) {
      throw new ApiException("UNAUTHORIZED", 401, "Authentication required");
    }
    if (request.user.role !== "ADMIN") {
      throw new ApiException("FORBIDDEN", 403, "Administrator role required");
    }
    return true;
  }
}
