import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";

mkdirSync("results", { recursive: true });
const root = "node_modules";
const packages = [];

function inspectPackage(directory) {
  const manifestPath = join(directory, "package.json");
  if (!existsSync(manifestPath)) return;
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  packages.push({
    name: manifest.name,
    version: manifest.version,
    license: manifest.license ?? manifest.licenses ?? "UNKNOWN",
    repository:
      typeof manifest.repository === "string"
        ? manifest.repository
        : (manifest.repository?.url ?? null),
    homepage: manifest.homepage ?? null,
  });
}

for (const name of readdirSync(root)) {
  if (name.startsWith(".")) continue;
  const path = join(root, name);
  if (!statSync(path).isDirectory()) continue;
  if (name.startsWith("@")) {
    for (const child of readdirSync(path)) inspectPackage(join(path, child));
  } else {
    inspectPackage(path);
  }
}

packages.sort((a, b) =>
  `${a.name}@${a.version}`.localeCompare(`${b.name}@${b.version}`),
);
writeFileSync(
  "results/dependency-license-matrix.json",
  JSON.stringify(packages, null, 2),
);
const notices = [
  "# THIRD-PARTY NOTICES — V1.5 Technology Selection PoC",
  "",
  "Generated from installed package manifests. This is not legal advice.",
  "",
  ...packages.flatMap((item) => [
    `## ${item.name}@${item.version}`,
    `- License: ${typeof item.license === "string" ? item.license : JSON.stringify(item.license)}`,
    `- Repository: ${item.repository ?? "Not declared"}`,
    `- Homepage: ${item.homepage ?? "Not declared"}`,
    "",
  ]),
];
writeFileSync("results/THIRD_PARTY_NOTICES.md", notices.join("\n"));
console.log(`Recorded ${packages.length} installed packages`);
