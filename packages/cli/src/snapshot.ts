/**
 * 版本快照与回滚（08-roadmap Phase 6 P1，WORK-001）
 *
 * 「预览-确认-发布」工作流的恢复半边：publish 前对内容源（docs/）自动快照，
 * 出错/后悔可一键回滚——Agent 写入有沙箱式安全感，人一键恢复（research §五 工作流层）。
 *
 * 存储：<root>/.doclight/snapshots/<id>/
 * - <id> = YYYYMMDD-HHMMSS-<contentHash6>（内容哈希：同内容不产生新快照——幂等去重）
 * - manifest.json：{ createdAt, root, files[], bytes }（双读友好：Agent/人可读）
 * 快照是纯文件复制（零依赖、无 git 依赖——内容空间可能不是 git 仓库）。
 */
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";
export interface SnapshotInfo {
  /** 快照 ID（YYYYMMDD-HHMMSS-hash6） */
  id: string;
  /** 创建时间 ISO */
  createdAt: string;
  /** 快照源目录名（如 "docs"） */
  root: string;
  /** 文件数 */
  files: number;
  /** 总字节 */
  bytes: number;
}

/** 快照根目录（<root>/.doclight/snapshots） */
export function snapshotsDir(root: string): string {
  return join(resolve(root), ".doclight", "snapshots");
}

/** 内容哈希（排序后 路径+字节数 摘要；同内容幂等去重） */
function contentHash(dir: string): string {
  const hash = createHash("sha1");
  const walk = (d: string): void => {
    for (const entry of readdirSync(d).sort()) {
      const full = join(d, entry);
      const stat = statSync(full);
      if (stat.isDirectory()) walk(full);
      else hash.update(`${relative(dir, full)}:${stat.size};`);
    }
  };
  walk(dir);
  return hash.digest("hex").slice(0, 6);
}

function nowStamp(): string {
  const d = new Date();
  const p = (n: number, w = 2): string => String(n).padStart(w, "0");
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
}

/**
 * 对内容源目录拍摄快照（复制全部文件到 .doclight/snapshots/<id>/）。
 * 内容未变化（哈希相同）时返回既有同内容快照（幂等，不产生垃圾快照）。
 * 目录不存在 → 结构化错误（不伪造成功）。
 */
export function takeSnapshot(root: string, dir = "docs"): SnapshotInfo | { error: string } {
  const source = resolve(root, dir);
  if (!existsSync(source) || !statSync(source).isDirectory()) {
    return { error: `快照源目录不存在：${source}（检查 --dir / docs/）` };
  }
  const dirName = relative(root, source) || dir;
  const hash = contentHash(source);
  // 幂等去重：同内容（同 hash）已有快照 → 返回既有（时间戳不同但内容相同，不产生垃圾快照）
  const existing = listSnapshots(root).find((s) => s.id.endsWith(`-${hash}`));
  if (existing) return existing;
  const id = `${nowStamp()}-${hash}`;
  const out = join(snapshotsDir(root), id);
  mkdirSync(out, { recursive: true });
  const files: string[] = [];
  let bytes = 0;
  const copy = (d: string): void => {
    for (const entry of readdirSync(d)) {
      const full = join(d, entry);
      const stat = statSync(full);
      const rel = relative(source, full);
      if (stat.isDirectory()) {
        copy(full);
      } else {
        const dest = join(out, "content", rel);
        mkdirSync(dirname(dest), { recursive: true });
        writeFileSync(dest, readFileSync(full));
        files.push(rel.split(sep).join("/"));
        bytes += stat.size;
      }
    }
  };
  copy(source);
  writeFileSync(
    join(out, "manifest.json"),
    JSON.stringify({ createdAt: new Date().toISOString(), root: dirName, files, bytes }, null, 2)
  );
  return { id, createdAt: new Date().toISOString(), root: dirName, files: files.length, bytes };
}

/** 读取快照 manifest 数据（损坏/缺失 → null；id 由调用方按目录名给出） */
function readManifest(dir: string): Omit<SnapshotInfo, "id"> | null {
  try {
    const raw = JSON.parse(readFileSync(join(dir, "manifest.json"), "utf8")) as {
      createdAt: string;
      root: string;
      files: string[];
      bytes: number;
    };
    return { createdAt: raw.createdAt, root: raw.root, files: raw.files.length, bytes: raw.bytes };
  } catch {
    return null;
  }
}

/** 列出全部快照（新 → 旧） */
export function listSnapshots(root: string): SnapshotInfo[] {
  const base = snapshotsDir(root);
  if (!existsSync(base)) return [];
  const out: SnapshotInfo[] = [];
  for (const entry of readdirSync(base)) {
    const full = join(base, entry);
    if (!statSync(full).isDirectory()) continue;
    const manifest = readManifest(full);
    if (manifest) out.push({ ...manifest, id: entry });
  }
  // 按 createdAt 降序排序（新 → 旧），不依赖 ID 中的哈希值
  return out.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

/**
 * 从快照回滚：清空内容源目录 → 复制快照内容回来。
 * 快照不存在/损坏 → 结构化错误（不伪造成功；不碰内容源）。
 */
export function rollbackSnapshot(root: string, id: string, dir = "docs"): { ok: boolean; restored: string[]; error?: string } {
  const base = snapshotsDir(root);
  const snap = join(base, id);
  const source = resolve(root, dir);
  // 快照 ID 安全校验：只允许 [0-9A-Za-z-]（防路径穿越）
  if (!/^[\w-]+$/.test(id) || !existsSync(snap) || !statSync(snap).isDirectory()) {
    return { ok: false, restored: [], error: `快照不存在：${id}（doclight rollback --list 查看可用快照）` };
  }
  const content = join(snap, "content");
  if (!existsSync(content)) {
    return { ok: false, restored: [], error: `快照损坏：缺少 content/（${id}）` };
  }
  // 清空内容源（保留目录本身）
  if (existsSync(source)) {
    for (const entry of readdirSync(source)) rmSync(join(source, entry), { recursive: true, force: true });
  } else {
    mkdirSync(source, { recursive: true });
  }
  const restored: string[] = [];
  const copy = (d: string): void => {
    for (const entry of readdirSync(d)) {
      const full = join(d, entry);
      const stat = statSync(full);
      const rel = relative(content, full);
      if (stat.isDirectory()) {
        copy(full);
      } else {
        const dest = join(source, rel);
        mkdirSync(dirname(dest), { recursive: true });
        writeFileSync(dest, readFileSync(full));
        restored.push(rel.split(sep).join("/"));
      }
    }
  };
  copy(content);
  return { ok: true, restored };
}
