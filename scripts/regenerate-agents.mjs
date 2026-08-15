// 重新生成根 AGENTS.md（CAP-001：manifest 同源，dogfood）——注册表新增扩展后同步
import { writeFileSync } from "node:fs";
import { buildCapabilityManifest } from "../packages/cli/src/capabilities.ts";
import { buildAgentsMd } from "../packages/cli/src/agents.ts";

const manifest = buildCapabilityManifest({
  siteTitle: "DocLight",
  siteDescription: "把 Markdown 变成作品——零构建、AI 原生友好的开源文档站引擎",
  form: "dev",
  extensions: undefined, // 缺省 = 渲染内核默认白名单（含 tabs/steps）
});
writeFileSync("AGENTS.md", buildAgentsMd(manifest), "utf8");
console.log("AGENTS.md 已重新生成（扩展：", manifest.markdown.extensions.map((e) => e.id).join(", "), "）");
