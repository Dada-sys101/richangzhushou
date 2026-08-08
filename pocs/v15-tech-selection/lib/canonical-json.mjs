const textEncoder = new TextEncoder();

function isPlainObject(value) {
  if (value === null || typeof value !== "object") return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function canonicalize(value, path, seen) {
  if (value === null) return null;

  switch (typeof value) {
    case "string":
    case "boolean":
      return value;
    case "number":
      if (!Number.isFinite(value)) {
        throw new TypeError(`NON_FINITE_NUMBER_AT_${path}`);
      }
      return Object.is(value, -0) ? 0 : value;
    case "undefined":
    case "function":
    case "symbol":
    case "bigint":
      throw new TypeError(`UNSUPPORTED_JSON_VALUE_AT_${path}`);
    case "object":
      break;
    default:
      throw new TypeError(`UNSUPPORTED_JSON_VALUE_AT_${path}`);
  }

  if (seen.has(value)) {
    throw new TypeError(`CYCLIC_JSON_VALUE_AT_${path}`);
  }
  seen.add(value);

  try {
    if (Array.isArray(value)) {
      return value.map((entry, index) =>
        canonicalize(entry, `${path}[${index}]`, seen),
      );
    }

    if (!isPlainObject(value)) {
      throw new TypeError(`NON_PLAIN_JSON_OBJECT_AT_${path}`);
    }

    const normalized = {};
    for (const key of Object.keys(value).sort()) {
      normalized[key] = canonicalize(value[key], `${path}.${key}`, seen);
    }
    return normalized;
  } finally {
    seen.delete(value);
  }
}

function bytesToHex(bytes) {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join(
    "",
  );
}

export function canonicalizeJson(value) {
  return canonicalize(value, "$", new WeakSet());
}

export function canonicalStringify(value) {
  return JSON.stringify(canonicalizeJson(value));
}

export async function stableJsonSha256(value, cryptoProvider) {
  if (!cryptoProvider?.subtle) {
    throw new TypeError("A Web Crypto provider is required");
  }
  const canonical = canonicalStringify(value);
  const digest = await cryptoProvider.subtle.digest(
    "SHA-256",
    textEncoder.encode(canonical),
  );
  return bytesToHex(new Uint8Array(digest));
}
