// Spike：验证 Node 26 对 ESM-only 插件包与 .ts 插件文件的 require 能力
import { mkdtempSync, writeFileSync, mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { createRequire } from "node:module";

const root = mkdtempSync(join(tmpdir(), "doclight-loader-spike-"));
console.log("node:", process.version);

// --- 1) ESM-only 插件包（package.json type: module + export default）---
const esmPkg = join(root, "node_modules", "esm-plugin");
mkdirSync(esmPkg, { recursive: true });
writeFileSync(join(esmPkg, "package.json"), JSON.stringify({ name: "esm-plugin", version: "1.0.0", type: "module", main: "index.mjs" }));
writeFileSync(join(esmPkg, "index.mjs"), 'export default { name: "esm-plugin", version: "1.0.0" };\n');
writeFileSync(join(esmPkg, "index.mts"), 'export default { name: "esm-plugin-ts" };\n');

// --- 2) .ts 插件文件（相对路径，type stripping）---
const tsFile = join(root, "plugins", "my-plugin.ts");
mkdirSync(join(root, "plugins"), { recursive: true });
writeFileSync(tsFile, 'export default { name: "ts-plugin", version: "0.2.0", config: { a: 1 } };\n');

const require = createRequire(join(root, "package.json"));

function probe(label, fn) {
  try {
    const mod = fn();
    console.log(`${label} OK:`, JSON.stringify(mod));
  } catch (e) {
    console.log(`${label} FAIL:`, String(e.message ?? e).split("\n")[0]);
  }
}

probe("require(esm pkg by name)", () => require("esm-plugin"));
probe("require(index.mjs direct)", () => require(join(esmPkg, "index.mjs")));
probe("require(.ts file)", () => require(tsFile));
probe("require(.mts file)", () => require(join(esmPkg, "index.mts")));

// 3) require ESM 包带顶层 await（ESM-only 极端场景）
const tlaFile = join(esmPkg, "tla.mjs");
writeFileSync(tlaFile, 'const v = await Promise.resolve(42);\nexport default { name: "tla-plugin", v };\n');
probe("require(esm TLA)", () => require(tlaFile));

// 4) 检查 flags（experimental require-module / strip-types 是否默认）
const flags = process.features;
console.log("typescript feature:", JSON.stringify(flags.typescript ?? "n/a"));
console.log("require_module feature:", JSON.stringify(flags.require_module ?? "n/a"));

rmSync(root, { recursive: true, force: true });
