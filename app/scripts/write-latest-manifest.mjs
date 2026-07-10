#!/usr/bin/env node
/**
 * Génère latest.json (SHA256 installateur Windows) pour GitHub Release.
 * Usage : node scripts/write-latest-manifest.mjs [chemin/vers/EditraDoc-Setup.exe]
 */
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const appRoot = path.join(__dirname, "..");
const repoRoot = path.join(appRoot, "..");

const pkg = JSON.parse(fs.readFileSync(path.join(appRoot, "package.json"), "utf8"));
const version = String(pkg.version || "0.0.0");
const tag = process.env.RELEASE_TAG || `v${version}`;

const exeArg = process.argv[2];
const exePath = exeArg
  ? path.resolve(exeArg)
  : path.join(repoRoot, "EditraDoc-Setup.exe");

if (!fs.existsSync(exePath)) {
  console.error(`[write-latest-manifest] Installateur introuvable : ${exePath}`);
  process.exit(1);
}

const buf = fs.readFileSync(exePath);
const sha256 = crypto.createHash("sha256").update(buf).digest("hex");
const size = buf.length;

const manifest = {
  schemaVersion: 1,
  product: "EditraDoc",
  version,
  tag,
  publishedAt: new Date().toISOString(),
  releaseNotesUrl: `https://github.com/Matth031/EditraDoc/releases/tag/${tag}`,
  assets: {
    windows: {
      filename: "EditraDoc-Setup.exe",
      url: `https://github.com/Matth031/EditraDoc/releases/download/${tag}/EditraDoc-Setup.exe`,
      latestUrl:
        "https://github.com/Matth031/EditraDoc/releases/latest/download/EditraDoc-Setup.exe",
      sha256,
      size
    }
  }
};

const outCandidates = [
  path.join(repoRoot, "latest.json"),
  path.join(appRoot, "dist", "latest.json")
];

for (const outPath of outCandidates) {
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  console.log(`[write-latest-manifest] OK ${outPath} sha256=${sha256.slice(0, 12)}…`);
}
