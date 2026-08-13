/**
 * doclight.json 配置加载（02 §2.5 + 契约 contracts/doclight.schema.json）
 *
 * 零配置约定（02 §2.5.1）：无 doclight.json 也能跑，缺省取约定值。
 * 支持的键：
 * - 契约内（schema 已收录）：title / description / docsDir / theme
 * - Phase 3 新增（schema 扩展待批准，见交接文档）：base / siteUrl / outputDir
 *   —— 本模块「宽松读取」这些键，不改动契约文件（AGENT.md 红线：schema 修改需显式批准）。
 *
 * 优先级：CLI 选项 > 配置文件 > 约定默认。
 * 配置损坏时静默忽略（走约定默认），不阻断命令。
 */
import { existsSync, readFileSync } from "node:fs";

export interface DoclightConfig {
  title?: string;
  description?: string;
  docsDir?: string;
  theme?: string;
  /** 子路径基址（GitHub Pages 项目页等，如 "/docs"） */
  base?: string;
  /** 站点绝对 URL（canonical / sitemap / OG 用），如 "https://docs.example.com" */
  siteUrl?: string;
  /** 构建输出目录（缺省 dist-site） */
  outputDir?: string;
}

const KNOWN_KEYS = ["title", "description", "docsDir", "theme", "base", "siteUrl", "outputDir"] as const;

/** 加载配置文件：按候选路径顺序，首个存在且可解析者胜；全部失败返回空配置 */
export function loadConfig(candidates: string[]): DoclightConfig {
  for (const file of candidates) {
    if (!existsSync(file)) continue;
    try {
      const raw = JSON.parse(readFileSync(file, "utf8")) as Record<string, unknown>;
      const cfg: DoclightConfig = {};
      for (const key of KNOWN_KEYS) {
        const v = raw[key];
        if (typeof v === "string" && v) cfg[key] = v;
      }
      return cfg;
    } catch {
      /* 配置损坏时忽略，走约定默认 */
    }
  }
  return {};
}
