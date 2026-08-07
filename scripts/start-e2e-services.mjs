import { spawn, spawnSync } from "node:child_process";
import { createWriteStream, mkdirSync } from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const npmCli = path.join(
  path.dirname(process.execPath),
  "node_modules",
  "npm",
  "bin",
  "npm-cli.js",
);
const API = "http://127.0.0.1:3000";
const WEB = "http://127.0.0.1:5173";
const ADMIN = "http://127.0.0.1:5174";
const children = [];

const databaseUrl =
  process.env.E2E_DATABASE_URL ?? process.env.DATABASE_URL ?? "";
const adminPassword = process.env.E2E_ADMIN_PASSWORD ?? "E2eAdminPassword123!";
const adminUsername = process.env.E2E_ADMIN_USERNAME ?? "e2eadmin";

if (!databaseUrl) {
  console.error(
    "E2E services require a dedicated test database. Set E2E_DATABASE_URL (or DATABASE_URL in CI) to a disposable MySQL database.",
  );
  process.exit(2);
}
if (/staging|production|real|daily_assistant_local\b/i.test(databaseUrl)) {
  console.error("Refusing to run E2E services against a non-test database.");
  process.exit(2);
}

mkdirSync(path.join(root, "output", "e2e"), { recursive: true });

function runNpm(args, extraEnv = {}) {
  console.log(`[e2e] ${new Date().toISOString()} run npm ${args.join(" ")}`);
  const result = spawnSync(process.execPath, [npmCli, ...args], {
    cwd: root,
    encoding: "utf8",
    env: { ...process.env, ...extraEnv },
    stdio: "inherit",
  });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

function spawnService(name, args) {
  console.log(`[e2e] ${new Date().toISOString()} spawn ${name}`);
  const logFile = path.join(root, "output", "e2e", `${name}.log`);
  const output = spawn(process.execPath, [npmCli, ...args], {
    cwd: root,
    env: {
      ...process.env,
      DATABASE_URL: databaseUrl,
      E2E_ADMIN_PASSWORD: adminPassword,
      LOCAL_STORAGE_DIR:
        process.env.E2E_LOCAL_STORAGE_DIR ?? "output/e2e/storage",
      LOGIN_RATE_LIMIT_MAX: "1000",
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  output.stdout.pipe(createWriteStream(logFile, { flags: "a" }));
  output.stderr.pipe(createWriteStream(logFile, { flags: "a" }));
  children.push(output);
  return output;
}

async function waitFor(url, label, timeoutMs = 120_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      console.log(`[e2e] ${new Date().toISOString()} waiting ${label} ${url}`);
      const response = await fetch(url, {
        method: "GET",
        signal: AbortSignal.timeout(5_000),
      });
      await response.text();
      if (response.ok) {
        console.log(`[e2e] ${new Date().toISOString()} ready ${label}`);
        return;
      }
    } catch {
      // not ready yet
    }
    await new Promise((resolve) => setTimeout(resolve, 1_000));
  }
  throw new Error(`E2E service did not become ready: ${label} (${url})`);
}

async function prepareDatabase() {
  runNpm(["run", "prisma:generate", "--workspace", "@daily-assistant/api"]);
  runNpm(["run", "build", "--workspace", "@daily-assistant/api-contracts"]);
  runNpm(["run", "build", "--workspace", "@daily-assistant/config"]);
  runNpm(["run", "build", "--workspace", "@daily-assistant/api"]);
  runNpm(
    ["run", "prisma:migrate:deploy", "--workspace", "@daily-assistant/api"],
    { DATABASE_URL: databaseUrl },
  );
  runNpm(
    [
      "run",
      "bootstrap:admin",
      "--workspace",
      "@daily-assistant/api",
      "--",
      `--username=${adminUsername}`,
      "--display-name=E2E Admin",
    ],
    {
      ADMIN_BOOTSTRAP_PASSWORD: adminPassword,
      DATABASE_URL: databaseUrl,
    },
  );

  runNpm(["run", "e2e:prepare", "--workspace", "@daily-assistant/api"], {
    E2E_DATABASE_URL: databaseUrl,
  });
}

function shutdown() {
  for (const child of children) {
    try {
      if (process.platform === "win32" && child.pid) {
        spawnSync("taskkill", ["/pid", String(child.pid), "/T", "/F"], {
          stdio: "ignore",
        });
      } else {
        child.kill("SIGTERM");
      }
    } catch {
      // already stopped
    }
  }
}

async function main() {
  console.log(`[e2e] ${new Date().toISOString()} starting services`);
  await prepareDatabase();
  console.log(`[e2e] ${new Date().toISOString()} database prepared`);
  spawnService("api", ["run", "start", "--workspace", "@daily-assistant/api"]);
  spawnService("web", [
    "run",
    "dev",
    "--workspace",
    "@daily-assistant/web",
    "--",
    "--host",
    "127.0.0.1",
  ]);
  spawnService("admin", [
    "run",
    "dev",
    "--workspace",
    "@daily-assistant/admin",
    "--",
    "--host",
    "127.0.0.1",
  ]);

  await waitFor(`${API}/api/v1/health`, "API");
  await waitFor(WEB, "web");
  await waitFor(ADMIN, "admin");

  await new Promise((resolve) => {
    const stop = () => {
      shutdown();
      resolve();
    };
    process.on("SIGINT", stop);
    process.on("SIGTERM", stop);
  });
}

main().catch((error) => {
  console.error(error);
  shutdown();
  process.exit(1);
});

process.on("exit", shutdown);
