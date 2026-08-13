// Spike：Node 26 require(esm)/require(.ts) 的缓存行为与绕过方式
import { mkdtempSync, writeFileSync, mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { createRequire } from "node:module";

const root = mkdtempSync(join(tmpdir(), "doclight-cache-spike-"));
const tsFile = join(root, "plugin.ts");
writeFileSync(tsFile, 'export default { name: "v1" };\n');
const require = createRequire(join(root, "package.json"));

// 1) 首次加载
const r1 = require(tsFile);
console.log("first:", r1.default.name);

// 2) 改文件后直接再 require（验证是否缓存）
writeFileSync(tsFile, 'export default { name: "v2" };\n');
const r2 = require(tsFile);
console.log("second (no cache clear):", r2.default.name, r2.default.name === "v2" ? "→ NOT cached" : "→ CACHED");

// 3) 尝试 require.cache 清除（CJS 方式）
try {
  const resolvedId = require.resolve(tsFile);
  delete require.cache[resolvedId];
  console.log("require.cache has esm key:", resolvedId in require.cache);
} catch (e) {
  console.log("resolve fail:", e.message);
}
const r3 = require(tsFile);
console.log("third (after delete cache):", r3.default.name);

// 4) query 后缀绕过（file: URL + ?t=）
writeFileSync(tsFile, 'export default { name: "v3" };\n');
try {
  const { pathToFileURL } = await import("node:url");
  const url = pathToFileURL(tsFile);
  url.searchParams.set("t", String(Date.now()));
  const r4 = require(url.href);
  console.log("fourth (file URL + query):", r4.default.name);
} catch (e) {
  console.log("file URL + query FAIL:", String(e.message).split("\n")[0]);
}

rmSync(root, { recursive: true, force: true });
