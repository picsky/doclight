/**
 * capabilities.json —— 站点渲染能力协议（08-roadmap Phase 6 P0，CAP-001）
 *
 * 原则零（Agent-First）的第一落地：Agent 写内容前必须能回答「这个站能渲染什么」，
 * 而不是猜。capabilities.json 是机器可读的能力清单：
 * - Markdown 扩展语法（内置注册表白名单：容器 / KaTeX / 代码高亮…）
 * - 插件提供的语法与能力（如 mermaid 插件声明 capabilities: ["mermaid"]）
 * - frontmatter 约定（哪些键有语义）
 * - Agent 接口端点（llms.txt / docs.json / MCP…）
 * - 页面 URL 约定（.html + 每页 markdown 版本，AEO-001）
 *
 * 三形态一致（dev / SSG / bundle）：同一生成器（buildCapabilityManifest），
 * 三形态各自落位——SSG 产物根、dev server /capabilities.json、bundle 产物目录。
 * 双读友好（REND-004）：本文件是 AGENTS.md（人读）的机器形态；
 * buildAgentsMd（agents.ts）由同一 manifest 生成，单一事实来源。
 */
import { DEFAULT_EXTENSIONS } from "doclight-renderer";
import { toolDescriptors } from "doclight-mcp-server";

/** 扩展能力条目（内置注册表白名单；degradation 说明降级形态，Agent 据此判断可用性） */
export interface CapabilityExtension {
  id: string;
  title: string;
  degradation?: string;
}

/** 插件能力条目（doclight.json 启用插件；capabilities 由插件声明，如 ["mermaid"]） */
export interface CapabilityPlugin {
  name: string;
  version?: string;
  capabilities?: string[];
}

export interface CapabilityManifest {
  schemaVersion: 1;
  generatedAt: string;
  site: {
    title: string;
    description?: string;
    siteUrl?: string;
    base: string;
    language: string;
  };
  renderer: {
    engine: string;
    version: string;
    markdown: string;
  };
  markdown: {
    /** frontmatter 语义键（FRONT-001 约定） */
    frontmatter: string[];
    /** 内置扩展语法白名单（REND-002 注册表） */
    extensions: CapabilityExtension[];
  };
  /** 启用插件（含各自声明的能力） */
  plugins: CapabilityPlugin[];
  /** Agent 接口产物端点（站点根相对路径） */
  outputs: string[];
  pages: {
    htmlSuffix: string;
    /** AEO-001：每页是否有 markdown 版本（.md 副本 + link rel=alternate） */
    markdownAlternate: boolean;
  };
  mcp: {
    endpoint: string;
    wellKnown: string;
    tools: string[];
  };
  tokens: {
    /** token 估算方法（AEO-001；诚实声明启发式，非真实分词器） */
    estimate: string;
  };
}

export interface CapabilityOptions {
  siteTitle: string;
  siteDescription?: string;
  siteUrl?: string;
  /** 子路径基址（normalizeBase 归一，缺省 ""） */
  base?: string;
  /** 形态：ssg 每页有 markdown 版本；dev 相同；bundle 单文件无独立页面 URL */
  form: "dev" | "ssg" | "bundle";
  /** 启用插件列表（由构建管线注入；缺省空） */
  plugins?: CapabilityPlugin[];
  /** 生成时间（可注入，可测） */
  generatedAt?: string;
  /** 扩展白名单（缺省渲染内核默认注册表——单一事实来源） */
  extensions?: CapabilityExtension[];
}

/** frontmatter 语义键清单（FRONT-001 + 06 §6.3.1；与 analyzeDoc/build 消费键一致） */
export const FRONTMATTER_KEYS = [
  "title",
  "description",
  "summary",
  "date",
  "updated",
  "priority",
  "tags",
  "category",
  "difficulty",
  "author",
  "prerequisites",
  "next",
] as const;

/** 渲染内核引擎声明（与 packages/renderer/src/index.ts rendererVersion 一致） */
export const RENDERER_ENGINE = "doclight-renderer";
export const RENDERER_VERSION = "0.1.0";

/** Agent 接口产物端点（站点根相对路径；与 llms.ts「Agent 专用端点」一致） */
export const AGENT_OUTPUTS = [
  "llms.txt",
  "llms-full.txt",
  "docs.json",
  "search-index.json",
  "capabilities.json",
  ".well-known/mcp",
] as const;

/**
 * 生成能力清单（纯函数，可测）。扩展/插件/端点全部来自单一事实来源：
 * 渲染内核注册表 + 启用插件 + MCP 工具注册表。
 */
export function buildCapabilityManifest(options: CapabilityOptions): CapabilityManifest {
  const extensions: CapabilityExtension[] = (options.extensions ?? DEFAULT_EXTENSIONS).map((e) => ({
    id: e.id,
    title: e.title,
    ...(e.degradation ? { degradation: e.degradation } : {}),
  }));
  return {
    schemaVersion: 1,
    generatedAt: options.generatedAt ?? new Date().toISOString(),
    site: {
      title: options.siteTitle,
      ...(options.siteDescription ? { description: options.siteDescription } : {}),
      ...(options.siteUrl ? { siteUrl: options.siteUrl } : {}),
      base: options.base ?? "",
      language: "zh-CN",
    },
    renderer: {
      engine: RENDERER_ENGINE,
      version: RENDERER_VERSION,
      markdown: "CommonMark + GFM（marked）+ DOMPurify sanitize（REND-001）",
    },
    markdown: {
      frontmatter: [...FRONTMATTER_KEYS],
      extensions,
    },
    plugins: options.plugins ?? [],
    outputs: [...AGENT_OUTPUTS],
    pages: {
      htmlSuffix: ".html",
      markdownAlternate: options.form !== "bundle",
    },
    mcp: {
      endpoint: "/mcp",
      wellKnown: "/.well-known/mcp",
      tools: toolDescriptors().map((t) => t.name),
    },
    tokens: {
      estimate: "启发式估算：CJK 字符 ×0.75 + 非 CJK 词 ×1.3，上取整（非真实分词器）",
    },
  };
}
