import { startDevServer } from "../packages/cli/src/dev-server.ts";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const dir = mkdtempSync(join(tmpdir(), "doclight-vendor-"));
writeFileSync(join(dir, "README.md"), "# hi\n");
const server = await startDevServer({ dir });
for (const p of ["/__doclight/vendor/prism.min.js", "/__doclight/vendor/mermaid.min.js", "/__doclight/vendor/katex.min.js", "/__doclight/vendor/katex.min.css"]) {
  const res = await fetch(server.url.replace(/\/$/, "") + p);
  const text = await res.text();
  console.log(p, "→", res.status, res.headers.get("content-type"), "len", text.length, text.slice(0, 60).replace(/\n/g, " "));
}
await server.close();
