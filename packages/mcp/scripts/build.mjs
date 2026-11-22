/**
 * Bundle src/index.ts into a single self-contained dist/index.js.
 *
 * Everything is inlined — @intruva/engine (unpublished workspace package),
 * @modelcontextprotocol/sdk and zod — so the published package has zero
 * runtime dependencies and `npx intruva-mcp` needs nothing else installed.
 * Licenses of bundled third-party packages are collected into
 * dist/THIRD_PARTY_LICENSES.txt.
 */
import { build } from "esbuild";
import { chmod, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const pkg = JSON.parse(await readFile(join(root, "package.json"), "utf8"));
const outfile = join(root, "dist/index.js");

await rm(join(root, "dist"), { recursive: true, force: true });
await mkdir(join(root, "dist"), { recursive: true });

const result = await build({
  entryPoints: [join(root, "src/index.ts")],
  outfile,
  bundle: true,
  platform: "node",
  format: "esm",
  target: "node20",
  minify: false,
  sourcemap: false,
  legalComments: "inline",
  metafile: true,
  logLevel: "warning",
  define: { __INTRUVA_MCP_VERSION__: JSON.stringify(pkg.version) },
  banner: {
    // Shebang + a real `require` for bundled CommonJS deps that require() node builtins.
    js: [
      "#!/usr/bin/env node",
      'import { createRequire as __intruvaCreateRequire } from "node:module";',
      "const require = __intruvaCreateRequire(import.meta.url);",
    ].join("\n"),
  },
});
await chmod(outfile, 0o755);

// Collect licenses for every third-party package that ended up in the bundle.
const pkgDirs = new Set();
for (const input of Object.keys(result.metafile.inputs)) {
  const m = input.match(/^(.*node_modules\/(?:@[^/]+\/)?[^/]+)\//);
  if (m) pkgDirs.add(m[1]);
}
const sections = [];
for (const dir of [...pkgDirs].sort()) {
  const abs = resolve(root, dir);
  const meta = JSON.parse(await readFile(join(abs, "package.json"), "utf8"));
  const licenseFile = ["LICENSE", "LICENSE.md", "LICENSE.txt", "license", "LICENCE"].map((f) => join(abs, f)).find(existsSync);
  const text = licenseFile ? (await readFile(licenseFile, "utf8")).trim() : `License: ${meta.license ?? "unknown"}`;
  sections.push(`${meta.name}@${meta.version} (${meta.license ?? "unknown"})\n${"-".repeat(60)}\n${text}`);
}
await writeFile(
  join(root, "dist/THIRD_PARTY_LICENSES.txt"),
  `intruva-mcp bundles the following third-party packages:\n\n${sections.join("\n\n\n")}\n`,
);

const bytes = (await readFile(outfile)).length;
console.log(`built dist/index.js (${(bytes / 1024).toFixed(0)} KiB, ${pkgDirs.size} bundled packages)`);
