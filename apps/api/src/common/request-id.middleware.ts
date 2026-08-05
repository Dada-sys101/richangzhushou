import { randomUUID } from "node:crypto";

import type { NextFunction, Request, Response } from "express";

export interface RequestWithId extends Request {
  requestId?: string;
}

export function requestIdMiddleware(
  request: RequestWithId,
  response: Response,
  next: NextFunction,
): void {
  request.requestId = `req_${randomUUID()}`;
  response.setHeader("X-Request-Id", request.requestId);
  next();
}
