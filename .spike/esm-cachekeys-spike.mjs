// Spike：检查 require(esm) 的缓存键形态
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { createRequire } from "node:module";

const root = mkdtempSync(join(tmpdir(), "doclight-cachekeys-"));
const tsFile = join(root, "plugin.ts");
writeFileSync(tsFile, 'export default { name: "v1" };\n');
const require = createRequire(join(root, "package.json"));

require(tsFile);
console.log("resolvedId:", require.resolve(tsFile));
const keys = Object.keys(require.cache);
console.log("require.cache keys:", JSON.stringify(keys));
// 找含 plugin.ts 的键
for (const k of keys) if (k.includes("plugin")) console.log("  plugin key:", k);

// 尝试用 file:// URL require 看是否进 cache
const { pathToFileURL } = await import("node:url");
try {
  const url = pathToFileURL(tsFile).href;
  const mod = require(url);
  console.log("require(fileURL) OK:", mod.default.name);
  console.log("after fileURL require, cache keys:", Object.keys(require.cache).filter((k) => k.includes("plugin")));
} catch (e) {
  console.log("require(fileURL) FAIL:", String(e.message).split("\n")[0]);
}

rmSync(root, { recursive: true, force: true });
