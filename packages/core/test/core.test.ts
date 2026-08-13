import { describe, expect, it } from "vitest";
import { SUPPORTED_FORMS, SLOT_NAMES } from "../src/index.ts";
import type { DocLightConfig, PluginDef } from "../src/index.ts";

describe("doclight-core 公共类型与常量（Phase 0）", () => {
  it("三形态产物常量完整且有序", () => {
    expect(SUPPORTED_FORMS).toEqual(["dev", "ssg", "bundle"]);
  });

  it("DocLightConfig 类型可承载最小配置", () => {
    const config: DocLightConfig = { title: "test", theme: "minimal" };
    expect(config.title).toBe("test");
  });
});

describe("doclight-core 插件类型（PLUG-003）", () => {
  it("SLOT_NAMES 包含 11 个标准插槽", () => {
    expect(SLOT_NAMES).toHaveLength(11);
    expect(SLOT_NAMES).toContain("head:start");
    expect(SLOT_NAMES).toContain("head:end");
    expect(SLOT_NAMES).toContain("sidebar:before");
    expect(SLOT_NAMES).toContain("sidebar:after");
    expect(SLOT_NAMES).toContain("topbar:before");
    expect(SLOT_NAMES).toContain("topbar:after");
    expect(SLOT_NAMES).toContain("content:before");
    expect(SLOT_NAMES).toContain("content:after");
    expect(SLOT_NAMES).toContain("toc:before");
    expect(SLOT_NAMES).toContain("toc:after");
    expect(SLOT_NAMES).toContain("footer");
  });

  it("PluginDef 类型可承载完整插件声明", () => {
    const plugin: PluginDef = {
      name: "test-plugin",
      version: "1.0.0",
      config: { foo: "bar" },
      beforeRender: (md) => md,
      afterRender: (html) => html,
      init: () => {},
      onMount: () => {},
      onRouteChange: () => {},
      destroy: () => {},
      slotContent: { footer: "<div>footer</div>" },
    };
    expect(plugin.name).toBe("test-plugin");
    expect(plugin.slotContent?.footer).toBe("<div>footer</div>");
  });
});
