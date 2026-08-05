import type { AuthSessionResponse } from "@daily-assistant/api-contracts";

import type { AuthSessionResult } from "./auth.service.js";

export function toAuthResponse(result: AuthSessionResult): AuthSessionResponse {
  return {
    accessToken: result.accessToken,
    expiresIn: result.expiresIn,
    user: result.user,
  };
}
