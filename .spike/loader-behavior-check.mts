// 验证现有 loadPluginsSync 对 ESM-only 包 / TS 插件文件的实际行为
import { mkdtempSync, writeFileSync, mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { loadPluginsSync } from "file:///C:/Users/87854/Desktop/doclight/packages/cli/src/plugin-loader.ts";

const root = mkdtempSync(join(tmpdir(), "doclight-loader-behavior-"));

// ESM-only 插件包（node_modules）
const esmPkg = join(root, "node_modules", "esm-plugin");
mkdirSync(esmPkg, { recursive: true });
writeFileSync(join(esmPkg, "package.json"), JSON.stringify({ name: "esm-plugin", version: "1.0.0", type: "module", main: "index.mjs" }));
writeFileSync(join(esmPkg, "index.mjs"), 'export default { name: "esm-plugin", version: "1.0.0" };\n');

// TS 插件文件（相对路径）
mkdirSync(join(root, "plugins"), { recursive: true });
writeFileSync(join(root, "plugins", "my-plugin.ts"), 'export default { name: "ts-plugin", version: "0.2.0" };\n');

const r1 = loadPluginsSync([{ name: "esm-plugin" }], root);
console.log("ESM pkg:", JSON.stringify({ plugins: r1.plugins.map((p) => p.name), skipped: r1.skipped }));

const r2 = loadPluginsSync([{ name: "./plugins/my-plugin.ts" }], root);
console.log("TS file:", JSON.stringify({ plugins: r2.plugins.map((p) => p.name), skipped: r2.skipped }));

rmSync(root, { recursive: true, force: true });
