/**
 * Agent 技能安装测试（AGENT-001：doclight skill install / list）
 *
 * 覆盖：源解析（dist 形态 / 源码形态）/ SKILL.md frontmatter 校验 / 安装计划
 * （安装/跳过/覆盖/非法）/ 幂等 / dry-run 不写入 / 诚实报错 / 清单。
 */
import { describe, expect, it } from "vitest";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { parseSkillMeta, planSkillInstall, resolveSource, skillInstall, skillList, type SkillSource } from "../src/skill.ts";

/** 构造一个假的技能源树（2 个合法技能 + 1 个缺 frontmatter 的非法技能 + 1 个空目录 + 1 个命令） */
function makeSourceTree(root: string): SkillSource {
  const skills = join(root, "skills");
  const commands = join(root, "commands");
  mkdirSync(join(skills, "doclight-publish"), { recursive: true });
  writeFileSync(
    join(skills, "doclight-publish", "SKILL.md"),
    '---\nname: doclight-publish\ndescription: 内容发布技能\n---\n\n# publish\n',
    "utf8",
  );
  mkdirSync(join(skills, "doclight-slides"), { recursive: true });
  writeFileSync(
    join(skills, "doclight-slides", "SKILL.md"),
    '---\nname: doclight-slides\ndescription: 演示编排技能\n---\n\n# slides\n',
    "utf8",
  );
  mkdirSync(join(skills, "bad-skill"), { recursive: true });
  writeFileSync(join(skills, "bad-skill", "SKILL.md"), "# 没有 frontmatter\n", "utf8");
  mkdirSync(join(skills, "empty-dir"), { recursive: true }); // 无 SKILL.md → 静默忽略
  mkdirSync(commands, { recursive: true });
  writeFileSync(join(commands, "publish.md"), "---\ndescription: 发布\n---\n", "utf8");
  return { skills, commands };
}

describe("parseSkillMeta（SKILL.md frontmatter 校验）", () => {
  it("合法 frontmatter 解析出 name/description", () => {
    const root = mkdtempSync(join(tmpdir(), "doclight-skill-meta-"));
    try {
      const skills = join(root, "skills", "doclight-publish");
      mkdirSync(skills, { recursive: true });
      writeFileSync(join(skills, "SKILL.md"), '---\nname: doclight-publish\ndescription: 内容发布技能\n---\n\n# x\n', "utf8");
      expect(parseSkillMeta(skills)).toEqual({ name: "doclight-publish", description: "内容发布技能" });
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("缺 frontmatter / 缺 name / 文件不存在 → null", () => {
    const root = mkdtempSync(join(tmpdir(), "doclight-skill-meta-"));
    try {
      const noFm = join(root, "no-fm");
      mkdirSync(noFm, { recursive: true });
      writeFileSync(join(noFm, "SKILL.md"), "# 没有 frontmatter\n", "utf8");
      expect(parseSkillMeta(noFm)).toBeNull();

      const noName = join(root, "no-name");
      mkdirSync(noName, { recursive: true });
      writeFileSync(join(noName, "SKILL.md"), "---\ndescription: 没有 name\n---\n", "utf8");
      expect(parseSkillMeta(noName)).toBeNull();

      expect(parseSkillMeta(join(root, "missing"))).toBeNull();
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});

describe("resolveSource（技能源定位）", () => {
  it("dist 形态：skills/commands 与模块同目录", () => {
    const root = mkdtempSync(join(tmpdir(), "doclight-skill-src-"));
    try {
      const dist = join(root, "dist");
      mkdirSync(join(dist, "skills"), { recursive: true });
      mkdirSync(join(dist, "commands"), { recursive: true });
      const src = resolveSource(pathToFileURL(join(dist, "cli.mjs")).href);
      expect(src.skills).toBe(join(dist, "skills"));
      expect(src.commands).toBe(join(dist, "commands"));
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("源码形态：向上找到仓库根 .claude/skills", () => {
    const root = mkdtempSync(join(tmpdir(), "doclight-skill-src-"));
    try {
      mkdirSync(join(root, ".claude", "skills"), { recursive: true });
      mkdirSync(join(root, ".claude", "commands"), { recursive: true });
      const src = resolveSource(pathToFileURL(join(root, "packages", "cli", "src", "index.ts")).href);
      expect(src.skills).toBe(join(root, ".claude", "skills"));
      expect(src.commands).toBe(join(root, ".claude", "commands"));
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("两侧都缺失 → 空对象（遇到 .git 仓库边界即停，不逃逸到 ~/.claude）", () => {
    const root = mkdtempSync(join(tmpdir(), "doclight-skill-src-"));
    try {
      mkdirSync(join(root, ".git"), { recursive: true }); // 仓库边界：向上到此为止
      mkdirSync(join(root, "x"), { recursive: true });
      expect(resolveSource(pathToFileURL(join(root, "x", "y.ts")).href)).toEqual({});
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});

describe("planSkillInstall（安装计划纯函数）", () => {
  it("全新目标：合法技能 + 命令 = install；缺 frontmatter = invalid；空目录忽略", () => {
    const root = mkdtempSync(join(tmpdir(), "doclight-skill-plan-"));
    try {
      const source = makeSourceTree(root);
      const actions = planSkillInstall(source, join(root, "target"), false);
      const byKind = (kind: string) => actions.filter((a) => a.kind === kind).map((a) => a.name).sort();
      expect(byKind("install")).toEqual(["doclight-publish", "doclight-slides", "publish.md"]);
      expect(byKind("invalid")).toEqual(["bad-skill"]);
      expect(actions.some((a) => a.name === "empty-dir")).toBe(false);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("已存在且内容相同 → skip（幂等）；内容不同 → 默认 skip、--force 覆盖", () => {
    const root = mkdtempSync(join(tmpdir(), "doclight-skill-plan-"));
    try {
      const source = makeSourceTree(root);
      const target = join(root, "target");
      // 先装一遍
      skillInstall({ source, targetRoot: target, moduleUrl: "file:///unused.ts" });
      const second = planSkillInstall(source, target, false);
      expect(second.filter((a) => a.kind === "install")).toEqual([]);
      expect(second.filter((a) => a.kind === "skip").map((a) => a.name).sort()).toEqual(["doclight-publish", "doclight-slides", "publish.md"]);

      // 改内容 → 默认 skip；--force → overwrite
      writeFileSync(join(target, "skills", "doclight-publish", "SKILL.md"), "自定义内容", "utf8");
      const noForce = planSkillInstall(source, target, false).find((a) => a.name === "doclight-publish")!;
      expect(noForce.kind).toBe("skip");
      expect(noForce.reason).toContain("--force");
      const forced = planSkillInstall(source, target, true).find((a) => a.name === "doclight-publish")!;
      expect(forced.kind).toBe("overwrite");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});

describe("skillInstall（执行安装）", () => {
  it("安装技能 + 命令到目标；非法技能报错但其余成功（诚实原则）", () => {
    const root = mkdtempSync(join(tmpdir(), "doclight-skill-install-"));
    try {
      const source = makeSourceTree(root);
      const target = join(root, "target");
      const result = skillInstall({ source, targetRoot: target, moduleUrl: "file:///unused.ts" });
      expect(result.ok).toBe(false); // 有非法技能 → 不伪造成功
      expect(result.installed.sort()).toEqual(["doclight-publish", "doclight-slides", "publish.md"]);
      expect(result.errors.map((e) => e.name)).toEqual(["bad-skill"]);
      expect(existsSync(join(target, "skills", "doclight-publish", "SKILL.md"))).toBe(true);
      expect(existsSync(join(target, "commands", "publish.md"))).toBe(true);
      expect(existsSync(join(target, "skills", "bad-skill", "SKILL.md"))).toBe(false);
      expect(result.steps.length).toBeGreaterThan(0);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("dry-run 只列计划不写入", () => {
    const root = mkdtempSync(join(tmpdir(), "doclight-skill-install-"));
    try {
      const source = makeSourceTree(root);
      const target = join(root, "target");
      const result = skillInstall({ source, targetRoot: target, moduleUrl: "file:///unused.ts", dryRun: true });
      expect(result.installed).toContain("安装 doclight-publish");
      expect(existsSync(join(target, "skills"))).toBe(false);
      expect(result.steps.some((s) => s.includes("dry-run"))).toBe(true);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("找不到技能源 → ok:false + 修复指引", () => {
    const result = skillInstall({ moduleUrl: "file:///C:/nonexistent/cli.mjs" });
    expect(result.ok).toBe(false);
    expect(result.errors[0]?.name).toBe("source");
    expect(result.steps.length).toBeGreaterThan(0);
  });
});

describe("skillList（安装清单）", () => {
  it("列出技能 + 命令的安装状态", () => {
    const root = mkdtempSync(join(tmpdir(), "doclight-skill-list-"));
    try {
      const source = makeSourceTree(root);
      const target = join(root, "target");
      const before = skillList({ source, targetRoot: target, moduleUrl: "file:///unused.ts" });
      expect(before.every((s) => !s.installed)).toBe(true);
      expect(before.map((s) => s.name).sort()).toEqual(["bad-skill", "doclight-publish", "doclight-slides", "publish.md"]);

      skillInstall({ source, targetRoot: target, moduleUrl: "file:///unused.ts" });
      const after = skillList({ source, targetRoot: target, moduleUrl: "file:///unused.ts" });
      const publish = after.find((s) => s.name === "doclight-publish")!;
      expect(publish.installed).toBe(true);
      expect(publish.description).toBe("内容发布技能");
      const cmd = after.find((s) => s.name === "publish.md")!;
      expect(cmd.installed).toBe(true);
      expect(readFileSync(cmd.targetPath, "utf8")).toContain("description");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
