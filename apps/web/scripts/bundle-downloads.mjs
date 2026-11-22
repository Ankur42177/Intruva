#!/usr/bin/env node
/**
 * Packages the Intruva MCP server for download from the website.
 * Runs automatically before `next build` and `next dev` (prebuild / predev).
 *
 * Output (apps/web/public/downloads/, git-ignored, regenerated every build):
 *   intruva-mcp.tgz                 npm package tarball → `npx --package=<url> intruva-mcp`
 *   intruva-mcp-<version>.tgz       same file, versioned name
 *   intruva-mcp.js                  single self-contained file → `node intruva-mcp.js`
 *   THIRD_PARTY_LICENSES.txt        licenses of the bundled open-source packages
 *   manifest.json                   version, sizes, SHA-256 (read by /developers at build time)
 */
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const webDir = resolve(here, "..");
const repoRoot = resolve(webDir, "../..");
const mcpDir = join(repoRoot, "packages/mcp");
const outDir = join(webDir, "public/downloads");

if (!existsSync(join(mcpDir, "package.json"))) {
  console.warn("[downloads] packages/mcp not found; skipping MCP downloads");
  process.exit(0);
}

const pkg = JSON.parse(readFileSync(join(mcpDir, "package.json"), "utf8"));
rmSync(outDir, { recursive: true, force: true });
mkdirSync(outDir, { recursive: true });

// `npm pack` runs the package's prepack (esbuild bundle) and writes the tarball.
const npm = process.platform === "win32" ? "npm.cmd" : "npm";
execFileSync(npm, ["pack", "--workspace", "intruva-mcp", "--pack-destination", outDir, "--silent"], {
  cwd: repoRoot,
  stdio: ["ignore", "ignore", "inherit"],
});

const versioned = readdirSync(outDir).find((f) => f.startsWith("intruva-mcp-") && f.endsWith(".tgz"));
if (!versioned) throw new Error("[downloads] npm pack produced no tarball");
copyFileSync(join(outDir, versioned), join(outDir, "intruva-mcp.tgz"));
copyFileSync(join(mcpDir, "dist/index.js"), join(outDir, "intruva-mcp.js"));
if (existsSync(join(mcpDir, "dist/THIRD_PARTY_LICENSES.txt"))) {
  copyFileSync(join(mcpDir, "dist/THIRD_PARTY_LICENSES.txt"), join(outDir, "THIRD_PARTY_LICENSES.txt"));
}

const describe = (name) => {
  const p = join(outDir, name);
  const buf = readFileSync(p);
  return { name, size: statSync(p).size, sha256: createHash("sha256").update(buf).digest("hex") };
};

const manifest = {
  name: pkg.name,
  version: pkg.version,
  node: pkg.engines?.node ?? ">=20",
  built_at: new Date().toISOString(),
  files: {
    tarball: describe("intruva-mcp.tgz"),
    tarball_versioned: describe(versioned),
    single_file: describe("intruva-mcp.js"),
  },
};
writeFileSync(join(outDir, "manifest.json"), JSON.stringify(manifest, null, 2) + "\n");

const kb = (n) => `${(n / 1024).toFixed(0)} KiB`;
console.log(
  `[downloads] ${pkg.name}@${pkg.version}: tgz ${kb(manifest.files.tarball.size)}, js ${kb(manifest.files.single_file.size)} → public/downloads`,
);
