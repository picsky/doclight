import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const dir = "c:\\Users\\87854\\Desktop\\doclight\\.design_library\\doclight\\components";
for (const f of readdirSync(dir)) {
  if (!f.endsWith(".json") || f === "index.json") continue;
  const slug = f.replace(/\.json$/, "");
  const path = join(dir, f);
  const data = JSON.parse(readFileSync(path, "utf8"));
  data.slug = slug;
  writeFileSync(path, JSON.stringify(data, null, 2));
  console.log("added slug", slug);
}
