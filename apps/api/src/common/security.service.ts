import { createHash, randomBytes, randomInt } from "node:crypto";

import { Injectable } from "@nestjs/common";
import { hash, verify } from "argon2";
import { jwtVerify, SignJWT } from "jose";

const ACCESS_TOKEN_ALGORITHM = "HS256";
const INVITE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export interface AccessTokenPayload {
  sessionId: string;
  sub: string;
  role: string;
}

@Injectable()
export class SecurityService {
  private readonly accessTokenSecret: Uint8Array;

  constructor() {
    const secret =
      process.env.ACCESS_TOKEN_SECRET ??
      "local-development-only-access-token-secret-change-me";
    if (
      process.env.NODE_ENV === "production" &&
      !process.env.ACCESS_TOKEN_SECRET
    ) {
      throw new Error("ACCESS_TOKEN_SECRET is required in production");
    }
    this.accessTokenSecret = new TextEncoder().encode(secret);
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

  generateRefreshToken(): string {
    return randomBytes(32).toString("base64url");
  }

  generateRecoveryToken(): string {
    return randomBytes(32).toString("base64url");
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
}
