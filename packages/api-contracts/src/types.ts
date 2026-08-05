import type { ApiErrorCode } from "./enums.js";

/** API boundary IDs are strings even if storage choices change. */
export type Identifier = string;

/** ISO 8601 timestamp string at the API boundary. */
export type IsoDateTime = string;

/** Fixed-point decimal string; never a JavaScript binary floating-point amount. */
export type Money = string;

export interface FieldError {
  field: string;
  message: string;
}

export interface ErrorResponse {
  code: ApiErrorCode;
  fieldErrors?: FieldError[];
  message: string;
  requestId: string;
}

export interface PageInfo {
  nextCursor: string | null;
}

export interface VersionedResource {
  createdAt: IsoDateTime;
  deletedAt: IsoDateTime | null;
  id: Identifier;
  updatedAt: IsoDateTime;
  version: number;
}
