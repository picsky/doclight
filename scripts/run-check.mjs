// 通用 check 运行器：node scripts/run-check.mjs <checkId> [--json]
// check 模块位于 scripts/checks/<checkId>.mjs，统一导出 run() 返回标准 payload
import { main } from "./lib/report.mjs";

const checkId = process.argv[2];
if (!checkId) {
  console.error("用法：node scripts/run-check.mjs <checkId> [--json]");
  process.exit(2);
}

const mod = await import(`./checks/${checkId}.mjs`);
await main(mod.run);
