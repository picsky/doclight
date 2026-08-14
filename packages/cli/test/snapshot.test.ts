/**
 * WORK-001 快照/回滚测试：发布前自动快照 / 幂等去重 / 列表 / 回滚恢复 / 安全校验
 */
import { describe, expect, it } from "vitest";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { listSnapshots, rollbackSnapshot, snapshotsDir, takeSnapshot } from "../src/snapshot.ts";
import { publishSite } from "../src/publish.ts";

function tmpRoot(): string {
  const root = mkdtempSync(join(tmpdir(), "doclight-snap-"));
  mkdirSync(join(root, "docs", "guide"), { recursive: true });
  writeFileSync(join(root, "docs", "README.md"), "# 首页\n\n欢迎。");
  writeFileSync(join(root, "docs", "guide", "a.md"), "# A 文档");
  return root;
}

describe("takeSnapshot / listSnapshots（WORK-001）", () => {
  it("快照：复制全文 + manifest（路径/时间/文件数/字节）", () => {
    const root = tmpRoot();
    try {
      const snap = takeSnapshot(root, "docs");
      expect("error" in snap).toBe(false);
      const info = snap as { id: string; files: number; bytes: number; root: string };
      expect(info.files).toBe(2);
      expect(info.bytes).toBeGreaterThan(0);
      expect(info.root).toBe("docs");
      const base = snapshotsDir(root);
      expect(existsSync(join(base, info.id, "content", "guide", "a.md"))).toBe(true);
      expect(readFileSync(join(base, info.id, "content", "README.md"), "utf8")).toContain("首页");
      const manifest = JSON.parse(readFileSync(join(base, info.id, "manifest.json"), "utf8")) as { createdAt: string; files: string[] };
      expect(manifest.files).toContain("guide/a.md");
      expect(manifest.createdAt.length).toBeGreaterThan(10);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("内容未变化重复快照 → 幂等去重（同 id，不产生新目录）", () => {
    const root = tmpRoot();
    try {
      const first = takeSnapshot(root, "docs") as { id: string };
      const second = takeSnapshot(root, "docs") as { id: string };
      expect(second.id).toBe(first.id);
      const snaps = listSnapshots(root);
      expect(snaps).toHaveLength(1);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("内容变化 → 新快照（id 不同），列表新 → 旧", () => {
    const root = tmpRoot();
    try {
      const first = takeSnapshot(root, "docs") as { id: string };
      writeFileSync(join(root, "docs", "README.md"), "# 首页 v2");
      const second = takeSnapshot(root, "docs") as { id: string };
      expect(second.id).not.toBe(first.id);
      const snaps = listSnapshots(root);
      expect(snaps[0]!.id).toBe(second.id); // 新的在前
      expect(snaps[1]!.id).toBe(first.id);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("源目录不存在 → 结构化错误（不伪造）", () => {
    const root = tmpRoot();
    try {
      const snap = takeSnapshot(root, "ghost-dir");
      expect("error" in snap).toBe(true);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});

describe("rollbackSnapshot（WORK-001）", () => {
  it("回滚：清空内容源 → 复制回快照内容", () => {
    const root = tmpRoot();
    try {
      const snap = takeSnapshot(root, "docs") as { id: string };
      // 误改 + 误删
      writeFileSync(join(root, "docs", "README.md"), "# 被误改");
      rmSync(join(root, "docs", "guide", "a.md"));
      writeFileSync(join(root, "docs", "guide", "extra.md"), "# 多余");
      const result = rollbackSnapshot(root, snap.id, "docs");
      expect(result.ok).toBe(true);
      expect(result.restored).toContain("README.md");
      expect(result.restored).toContain("guide/a.md");
      expect(readFileSync(join(root, "docs", "README.md"), "utf8")).toContain("首页");
      expect(existsSync(join(root, "docs", "guide", "a.md"))).toBe(true);
      expect(existsSync(join(root, "docs", "guide", "extra.md"))).toBe(false); // 多余文件被清掉
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("快照不存在 / ID 非法 → 结构化错误且不碰内容源", () => {
    const root = tmpRoot();
    try {
      const before = readFileSync(join(root, "docs", "README.md"), "utf8");
      expect(rollbackSnapshot(root, "nope", "docs").ok).toBe(false);
      expect(rollbackSnapshot(root, "../evil", "docs").ok).toBe(false);
      expect(rollbackSnapshot(root, "a/b", "docs").ok).toBe(false);
      expect(readFileSync(join(root, "docs", "README.md"), "utf8")).toBe(before);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});

describe("publish 自动快照（WORK-001，CLI-005 集成）", () => {
  it("publish 成功携带 snapshot 信息；--no-snapshot 关闭", async () => {
    const root = tmpRoot();
    const out = mkdtempSync(join(tmpdir(), "doclight-snap-out-"));
    try {
      const result = await publishSite({ root, dir: "docs", outDir: out });
      expect(result.ok).toBe(true);
      expect(result.snapshot).toBeDefined();
      expect(result.snapshot!.files).toBe(2);
      expect(existsSync(join(snapshotsDir(root), result.snapshot!.id))).toBe(true);
      // 再发布（内容未变）→ 幂等（同快照 id）
      const again = await publishSite({ root, dir: "docs", outDir: out });
      expect(again.snapshot!.id).toBe(result.snapshot!.id);
      // --no-snapshot
      const noSnap = await publishSite({ root, dir: "docs", outDir: out, snapshot: false });
      expect(noSnap.snapshot).toBeUndefined();
    } finally {
      rmSync(root, { recursive: true, force: true });
      rmSync(out, { recursive: true, force: true });
    }
  });

  it("快照失败（源目录缺失）→ 发布中止 + 可读错误（内容安全优先）", async () => {
    const root = tmpRoot();
    try {
      const result = await publishSite({ root, dir: "ghost-docs" });
      expect(result.ok).toBe(false);
      expect(result.error).toContain("快照源目录不存在");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
