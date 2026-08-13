// Spike：import() + file URL query 是否绕过 Node 模块缓存（CJS / ESM / TS 三形态）
import { mkdtempSync, writeFileSync, mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { pathToFileURL } from "node:url";

const root = mkdtempSync(join(tmpdir(), "doclight-import-spike-"));

function writePlugin(name, body) {
  const f = join(root, `${name}.${name === "cjs" ? "js" : name === "esm" ? "mjs" : "ts"}`);
  writeFileSync(f, body);
  return f;
}
const cjsFile = writePlugin("cjs", "module.exports = { name: 'cjs-v1' };");
const esmFile = writePlugin("esm", 'export default { name: "esm-v1" };\n');
const tsFile = writePlugin("ts", 'export default { name: "ts-v1" };\n');

async function load(file, label) {
  const url = pathToFileURL(file);
  url.searchParams.set("t", String(Date.now()));
  const mod = await import(url.href);
  const def = mod.default ?? mod;
  console.log(`${label}:`, JSON.stringify(def));
  return def;
}

// CJS
await load(cjsFile, "cjs v1");
writeFileSync(cjsFile, "module.exports = { name: 'cjs-v2' };");
await load(cjsFile, "cjs v2 (query bypass)");

// ESM
await load(esmFile, "esm v1");
writeFileSync(esmFile, 'export default { name: "esm-v2" };\n');
await load(esmFile, "esm v2 (query bypass)");

// TS
await load(tsFile, "ts v1");
writeFileSync(tsFile, 'export default { name: "ts-v2" };\n');
await load(tsFile, "ts v2 (query bypass)");

// 无 query 再加载（确认 query 是绕过关键）
const plain = await import(pathToFileURL(tsFile).href);
console.log("ts no-query again:", JSON.stringify(plain.default ?? plain), "(应仍为 v2——缓存命中)");

rmSync(root, { recursive: true, force: true });
