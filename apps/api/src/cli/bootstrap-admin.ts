import "dotenv/config";

import { readFileSync } from "node:fs";

import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { hash } from "argon2";

import { PrismaClient } from "../generated/prisma/client.js";

const DEFAULT_DATABASE_URL =
  "mysql://daily_assistant:local-validation-only@127.0.0.1:3306/daily_assistant";

function parseArgs(): Map<string, string | boolean> {
  const args = new Map<string, string | boolean>();
  for (const arg of process.argv.slice(2)) {
    const parts = arg.split("=");
    const key = parts[0] ?? "";
    const value = parts[1];
    args.set(key, value === undefined ? true : value);
  }
  return args;
}

async function main(): Promise<void> {
  const args = parseArgs();
  const username = String(args.get("--username") ?? "")
    .trim()
    .toLowerCase();
  const displayName = String(args.get("--display-name") ?? "Administrator")
    .trim()
    .slice(0, 60);

  let password = process.env.ADMIN_BOOTSTRAP_PASSWORD;
  if (args.get("--password-stdin") === true) {
    password = readFileSync(0, "utf8").trim();
  }

  if (!username || !password) {
    console.error(
      "Usage: npm run bootstrap:admin -- --username=<username> [--display-name=<name>] [--password-stdin]\n" +
        "Set ADMIN_BOOTSTRAP_PASSWORD (or use --password-stdin) with at least 12 characters.",
    );
    process.exitCode = 2;
    return;
  }
  if (password.length < 12) {
    console.error("Admin bootstrap password must be at least 12 characters.");
    process.exitCode = 2;
    return;
  }

  const prisma = new PrismaClient({
    adapter: new PrismaMariaDb(
      process.env.DATABASE_URL ?? DEFAULT_DATABASE_URL,
    ),
  });
  await prisma.systemSetting.upsert({
    where: { id: "singleton" },
    create: {
      id: "singleton",
      maxActiveUsers: 20,
    },
    update: {},
  });

  const existing = await prisma.user.findUnique({
    where: { normalizedUsername: username },
  });
  if (existing) {
    if (existing.role === "ADMIN") {
      console.log("Admin account already exists; no changes made.");
      await prisma.$disconnect();
      return;
    }
    console.error(
      "A non-admin account with this username exists; refusing to escalate it.",
    );
    process.exitCode = 3;
    await prisma.$disconnect();
    return;
  }

  const passwordHash = await hash(password, { type: 2 });
  await prisma.user.create({
    data: {
      displayName,
      normalizedUsername: username,
      passwordHash,
      role: "ADMIN",
      status: "ACTIVE",
      username,
    },
  });
  console.log("Admin bootstrap account created.");
  await prisma.$disconnect();
}

main().catch((error) => {
  console.error("Admin bootstrap failed", error);
  process.exitCode = 1;
});
