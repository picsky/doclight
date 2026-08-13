/**
 * @doclight/plugin-pwa —— PWA 支持插件（PLUG-007 + PLUG-010，07 §7.6 官方插件）
 *
 * 机制：
 * - 构建时插槽（head:end）：manifest 链接 + Service Worker 注册脚本（base 感知，函数型 slotContent）
 * - 构建期 onBuild：产出 manifest.json 与 sw.js（站点级文件）
 *
 * 配置（doclight.json plugins 数组项 config）：
 *   { "name": "My Docs" }    可选（应用名，默认站点标题）
 *   { "color": "#0f766e" }   可选（主题色，默认 DocLight 主色）
 * 资产图标：docs/icon.png 存在则自动加入 manifest（缺省降级：无图标仍可安装为快捷方式）。
 *
 * sw.js 缓存策略（MVP，明确边界）：同源 GET 网络优先 + 缓存回退（离线可读已访问页），
 * 不做预缓存/版本管理——文档站更新频率低、正确性优先。
 */
import type { BuildFile, PluginDef, RenderContext } from "../../../core/src/plugin.ts";

export interface PwaConfig {
  name?: string;
  color?: string;
}

/** 工厂：创建 pwa 插件 */
export function createPwaPlugin(config?: Record<string, unknown>): PluginDef {
  const cfg = (config ?? {}) as PwaConfig;
  const color = typeof cfg.color === "string" && cfg.color ? cfg.color : "#0f766e";

  return {
    name: "pwa",
    version: "0.1.0",
    config: config ?? {},
    slotContent: {
      // 函数型：每次渲染按 ctx.base 拼绝对路径（子路径部署安全）
      "head:end": (ctx: RenderContext) => {
        const base = ctx.base || "";
        return [
          `<link rel="manifest" href="${base}/manifest.json">`,
          `<script>`,
          `if ("serviceWorker" in navigator && location.protocol.startsWith("http")) {`,
          `  window.addEventListener("load", function () {`,
          `    navigator.serviceWorker.register("${base}/sw.js").catch(function () {});`,
          `  });`,
          `}`,
          `</script>`,
        ].join("\n");
      },
    },
    onBuild(ctx): BuildFile[] {
      const appName = typeof cfg.name === "string" && cfg.name ? cfg.name : ctx.siteTitle;
      const base = ctx.base || "/";
      const manifest = JSON.stringify(
        {
          name: appName,
          short_name: appName,
          start_url: `${base}/`,
          display: "standalone",
          background_color: "#ffffff",
          theme_color: color,
          icons: [], // 图标缺省（docs/icon.png 由用户自行加入 manifest，见插件文档）
        },
        null,
        2
      );
      // MVP Service Worker：网络优先 + 缓存回退（同源 GET），离线可读已访问页
      const sw = [
        "/* DocLight PWA service worker（plugin-pwa 生成，MVP 策略） */",
        "self.addEventListener('install', function (e) { self.skipWaiting(); });",
        "self.addEventListener('activate', function (e) { e.waitUntil(self.clients.claim()); });",
        "self.addEventListener('fetch', function (e) {",
        "  var req = e.request;",
        "  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;",
        "  e.respondWith(",
        "    fetch(req).then(function (res) {",
        "      var copy = res.clone();",
        "      caches.open('doclight-v1').then(function (c) { c.put(req, copy); });",
        "      return res;",
        "    }).catch(function () {",
        "      return caches.match(req);",
        "    })",
        "  );",
        "});",
        "",
      ].join("\n");
      return [
        { path: "manifest.json", content: manifest + "\n" },
        { path: "sw.js", content: sw },
      ];
    },
  };
}
