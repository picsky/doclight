/**
 * doclight-core 入口（Phase 0 占位 + Phase 5 插件类型）
 *
 * 设计目标见 README.md：多包共享的类型与常量。
 * doclight.json 配置类型的完整定义见 contracts/doclight.schema.json。
 */

/** 三形态产物标识（02-architecture） */
export type ArtifactForm = "dev" | "ssg" | "bundle";

/** 三形态产物常量（供契约测试与遍历使用） */
export const SUPPORTED_FORMS: readonly ArtifactForm[] = ["dev", "ssg", "bundle"];

/** 站点配置（对应 contracts/doclight.schema.json，只加不改） */
export interface DocLightConfig {
  /** 站点标题（SSG 时用于 <title>） */
  title?: string;
  /** 站点描述（SSG 时用于 <meta description>） */
  description?: string;
  /** 文档目录（相对项目根，默认 docs/） */
  docsDir?: string;
  /** 主题模板（对应 11-default-themes 的 4 套） */
  theme?: string;
}

// Phase 5 插件系统类型（PLUG-003，07 §7）
export type {
  PluginDef,
  RenderContext,
  SearchDoc,
  AppApi,
  SlotName,
  PluginConfig,
} from "./plugin.ts";
export { SLOT_NAMES } from "./plugin.ts";
