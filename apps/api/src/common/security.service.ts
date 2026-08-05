import {
  createHash,
  createHmac,
  randomBytes,
  randomInt,
  timingSafeEqual,
} from "node:crypto";

import { Injectable } from "@nestjs/common";
import { hash, verify } from "argon2";
import { jwtVerify, SignJWT } from "jose";

import { ApiException } from "./api-error.js";

const ACCESS_TOKEN_ALGORITHM = "HS256";
const INVITE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const CONFIRMATION_TOKEN_PREFIX = "da_confirm_";
const CONFIRMATION_TOKEN_TTL_MS = 5 * 60 * 1000;

export interface AccessTokenPayload {
  sessionId: string;
  sub: string;
  role: string;
}

@Injectable()
export class SecurityService {
  private readonly accessTokenSecret: Uint8Array;
  private readonly confirmationSecret: Uint8Array;

  constructor() {
    const secret =
      process.env.ACCESS_TOKEN_SECRET ??
      "local-development-only-access-token-secret-change-me";
    const confirmationSecret =
      process.env.CONFIRMATION_TOKEN_SECRET ??
      "local-development-confirmation-token-secret-change-me";
    if (
      process.env.NODE_ENV === "production" &&
      !process.env.ACCESS_TOKEN_SECRET
    ) {
      throw new Error("ACCESS_TOKEN_SECRET is required in production");
    }
    this.accessTokenSecret = new TextEncoder().encode(secret);
    this.confirmationSecret = new TextEncoder().encode(confirmationSecret);
  }

  async hashPassword(password: string): Promise<string> {
    return hash(password, { type: 2 });
  }

  async verifyPassword(
    password: string,
    passwordHash: string,
  ): Promise<boolean> {
    return verify(passwordHash, password);
  }

  sha256(value: string): string {
    return createHash("sha256").update(value).digest("hex");
  }

  sha256Buffer(data: Buffer): string {
    return createHash("sha256").update(data).digest("hex");
  }

  generateRefreshToken(): string {
    return randomBytes(32).toString("base64url");
  }

  generateRecoveryToken(): string {
    return randomBytes(32).toString("base64url");
  }

  generateDeviceCredentialToken(): string {
    return randomBytes(32).toString("base64url");
  }

  generateUploadToken(): string {
    return randomBytes(32).toString("base64url");
  }

  signConfirmationToken(payload: {
    userId: string;
    draftIds: string[];
    reason: string;
  }): { token: string; expiresAt: Date } {
    const expiresAt = Date.now() + CONFIRMATION_TOKEN_TTL_MS;
    const sortedIds = [...new Set(payload.draftIds)].sort();
    const data = JSON.stringify({
      draftIds: sortedIds,
      expiresAt,
      reason: payload.reason,
      userId: payload.userId,
    });
    const signature = this.hmacSignature(data);
    const token =
      CONFIRMATION_TOKEN_PREFIX +
      Buffer.from(JSON.stringify({ data, signature }), "utf8").toString(
        "base64url",
      );
    return { expiresAt: new Date(expiresAt), token };
  }

  verifyConfirmationToken(token: string): {
    userId: string;
    draftIds: string[];
    reason: string;
    expiresAt: number;
  } {
    if (!token.startsWith(CONFIRMATION_TOKEN_PREFIX)) {
      throw new ApiException(
        "CONFIRMATION_TOKEN_INVALID",
        400,
        "Confirmation token is invalid",
      );
    }
    let parsed: { data: string; signature: string };
    try {
      const decoded = Buffer.from(
        token.slice(CONFIRMATION_TOKEN_PREFIX.length),
        "base64url",
      ).toString("utf8");
      parsed = JSON.parse(decoded) as { data: string; signature: string };
    } catch {
      throw new ApiException(
        "CONFIRMATION_TOKEN_INVALID",
        400,
        "Confirmation token is invalid",
      );
    }
    if (
      typeof parsed.data !== "string" ||
      typeof parsed.signature !== "string"
    ) {
      throw new ApiException(
        "CONFIRMATION_TOKEN_INVALID",
        400,
        "Confirmation token is invalid",
      );
    }
    const expected = this.hmacSignature(parsed.data);
    if (
      expected.length !== parsed.signature.length ||
      !timingSafeEqualText(expected, parsed.signature)
    ) {
      throw new ApiException(
        "CONFIRMATION_TOKEN_INVALID",
        400,
        "Confirmation token is invalid",
      );
    }
    let decoded: {
      draftIds?: string[];
      expiresAt?: number;
      reason?: string;
      userId?: string;
    };
    try {
      decoded = JSON.parse(parsed.data) as {
        draftIds?: string[];
        expiresAt?: number;
        reason?: string;
        userId?: string;
      };
    } catch {
      throw new ApiException(
        "CONFIRMATION_TOKEN_INVALID",
        400,
        "Confirmation token is invalid",
      );
    }
    const { draftIds, expiresAt, reason, userId } = decoded;
    if (
      !userId ||
      !Array.isArray(draftIds) ||
      typeof reason !== "string" ||
      !Number.isFinite(expiresAt)
    ) {
      throw new ApiException(
        "CONFIRMATION_TOKEN_INVALID",
        400,
        "Confirmation token is invalid",
      );
    }
    const expiresAtValue = expiresAt as number;
    if (expiresAtValue <= Date.now()) {
      throw new ApiException(
        "CONFIRMATION_TOKEN_EXPIRED",
        410,
        "Confirmation token has expired",
      );
    }
    return {
      draftIds,
      expiresAt: expiresAtValue,
      reason,
      userId,
    };
  }

  generateInviteCode(): string {
    let code = "";
    for (let index = 0; index < 16; index += 1) {
      code += INVITE_ALPHABET[randomInt(INVITE_ALPHABET.length)];
    }
    return code;
  }

  async signAccessToken(
    userId: string,
    role: string,
    sessionId: string,
    now = new Date(),
  ): Promise<{ token: string; expiresIn: number }> {
    const ttlSeconds = Number(process.env.ACCESS_TOKEN_TTL_SECONDS ?? 900);
    const token = await new SignJWT({
      role,
      sid: sessionId,
    })
      .setProtectedHeader({ alg: ACCESS_TOKEN_ALGORITHM })
      .setSubject(userId)
      .setIssuedAt(Math.floor(now.getTime() / 1000))
      .setExpirationTime(Math.floor(now.getTime() / 1000) + ttlSeconds)
      .sign(this.accessTokenSecret);
    return { token, expiresIn: ttlSeconds };
  }

  async verifyAccessToken(token: string): Promise<AccessTokenPayload> {
    const { payload } = await jwtVerify(token, this.accessTokenSecret, {
      algorithms: [ACCESS_TOKEN_ALGORITHM],
    });
    if (!payload.sub || typeof payload.sid !== "string") {
      throw new Error("Invalid access token payload");
    }
    return {
      sessionId: payload.sid,
      sub: payload.sub,
      role: String(payload.role ?? "USER"),
    };
  }

  private hmacSignature(data: string): string {
    return createHmac("sha256", this.confirmationSecret)
      .update(data)
      .digest("base64url");
  }
}

function timingSafeEqualText(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  if (leftBuffer.length !== rightBuffer.length) {
    return false;
  }
  return timingSafeEqual(leftBuffer, rightBuffer);
}
