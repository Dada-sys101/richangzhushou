import type { Session, User } from "../generated/prisma/client.js";
import type { RequestWithId } from "../common/request-id.middleware.js";

export interface AuthUser {
  mustChangePassword: boolean;
  userId: string;
  sessionId: string;
  role: "ADMIN" | "USER";
  status: User["status"];
  username: string;
}

export interface AuthenticatedRequest extends RequestWithId {
  user?: AuthUser;
  refreshSession?: Session & { user: User };
  deviceCredential?: DeviceCredentialPrincipal;
}

export interface DeviceCredentialPrincipal {
  id: string;
  userId: string;
  name: string;
  scopes: string[];
}
