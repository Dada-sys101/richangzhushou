import { createHash } from "node:crypto";

type CanonicalJsonValue =
  | boolean
  | null
  | number
  | string
  | CanonicalJsonValue[]
  | { [key: string]: CanonicalJsonValue };

/**
 * Deterministic JSON used by every PR18 fingerprint. Object keys are sorted
 * recursively, array order is preserved, and only JSON-compatible values are
 * accepted.
 */
export function canonicalJson(value: unknown): string {
  return JSON.stringify(toCanonicalValue(value));
}

export function sha256Fingerprint(value: unknown): string {
  return createHash("sha256").update(canonicalJson(value)).digest("hex");
}

function toCanonicalValue(value: unknown): CanonicalJsonValue {
  if (
    value === null ||
    typeof value === "string" ||
    typeof value === "boolean"
  ) {
    return value;
  }
  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      throw new TypeError("Canonical JSON does not support non-finite numbers");
    }
    return value;
  }
  if (Array.isArray(value)) {
    return value.map((item) => toCanonicalValue(item));
  }
  if (typeof value === "object") {
    const result: Record<string, CanonicalJsonValue> = {};
    for (const key of Object.keys(value as Record<string, unknown>).sort()) {
      const child = (value as Record<string, unknown>)[key];
      if (child !== undefined) {
        result[key] = toCanonicalValue(child);
      }
    }
    return result;
  }
  throw new TypeError(`Canonical JSON does not support ${typeof value}`);
}
