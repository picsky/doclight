import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { existsSync, mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadSpaceConfig, spaceConfigFile, spaceInit, spaceStatus, spaceSwitch } from "../src/space.ts";

let root: string;

beforeAll(() => {
  root = mkdtempSync(join(tmpdir(), "doclight-space-"));
});

afterAll(() => {
  rmSync(root, { recursive: true, force: true });
});

function readConfig(): ReturnType<typeof loadSpaceConfig> {
  return loadSpaceConfig(root);
}

describe("doclight space init（CLI-006，14 §3.4 空间初始化）", () => {
  it("默认 local：生成 .doclight/space.json + active=local + 产物目录 dist-bundle", () => {
    const result = spaceInit({ root });
    expect(existsSync(spaceConfigFile(root))).toBe(true);
    expect(result.created).toBe(true);
    expect(result.space).toBe("local");
    const cfg = readConfig();
    expect(cfg?.version).toBe(1);
    expect(cfg?.active).toBe("local");
    expect(cfg?.spaces["local"]?.provider).toBe("local");
    expect(cfg?.spaces["local"]?.outputDir).toBe("dist-bundle");
    expect(result.steps).toEqual([]); // 本地空间无引导步骤
  });

  it("幂等：重复运行不新建、不覆盖、active 不变", () => {
    const result = spaceInit({ root });
    expect(result.created).toBe(false);
    const cfg = readConfig();
    expect(cfg?.active).toBe("local");
    expect(Object.keys(cfg?.spaces ?? {})).toEqual(["local"]);
  });

  it("--provider git --remote：注册 git 空间并激活（branch=gh-pages）", () => {
    const result = spaceInit({ root, provider: "git", name: "gh", remoteUrl: "https://github.com/alice/my-docs.git" });
    expect(result.space).toBe("gh");
    const cfg = readConfig();
    expect(cfg?.active).toBe("gh");
    expect(cfg?.spaces["gh"]?.provider).toBe("git");
    expect(cfg?.spaces["gh"]?.remoteUrl).toBe("https://github.com/alice/my-docs.git");
    expect(cfg?.spaces["gh"]?.branch).toBe("gh-pages");
    expect(result.url).toBe("https://alice.github.io/my-docs/");
  });

  it("--provider space：注册 space 空间；托管未开通 → 不预填端点，引导配置", () => {
    const result = spaceInit({ root, provider: "space" });
    expect(result.space).toBe("space");
    const cfg = readConfig();
    expect(cfg?.spaces["space"]?.provider).toBe("space");
    expect(cfg?.spaces["space"]?.endpoint).toBeUndefined(); // 不伪造「已配好」
    expect(cfg?.spaces["space"]?.token).toBeUndefined();
    expect(result.url).toBeUndefined();
    expect(result.steps.length).toBeGreaterThan(0); // 引导：指向自建端点或先用 local/git
  });

  it("--provider space --endpoint：显式端点被保留", () => {
    spaceInit({ root, provider: "space", name: "selfhost", endpoint: "https://my-server.example/api" });
    const cfg = readConfig();
    expect(cfg?.spaces["selfhost"]?.endpoint).toBe("https://my-server.example/api");
    expect(cfg?.spaces["selfhost"]?.provider).toBe("space");
    expect(spaceStatus(root).spaces.find((s) => s.name === "selfhost")?.url).toBe("https://my-server.example");
  });
});

describe("doclight space switch / status（CLI-006）", () => {
  it("switch 切换 active 并持久化", () => {
    const result = spaceSwitch(root, "space");
    expect(result.ok).toBe(true);
    expect(result.active).toBe("space");
    expect(readConfig()?.active).toBe("space");
    // 切回 local
    spaceSwitch(root, "local");
    expect(readConfig()?.active).toBe("local");
  });

  it("switch 不存在的空间 → ok=false + 可读错误（不崩栈）", () => {
    const result = spaceSwitch(root, "nope");
    expect(result.ok).toBe(false);
    expect(result.error).toContain("nope");
    expect(result.error).toContain("space init");
  });

  it("status 返回结构化状态（active/provider/url/空间清单）", () => {
    const status = spaceStatus(root);
    expect(status.initialized).toBe(true);
    expect(status.active).toBe("local");
    expect(status.provider).toBe("local");
    const gh = status.spaces.find((s) => s.name === "gh");
    expect(gh?.url).toBe("https://alice.github.io/my-docs/");
    expect(status.spaces.some((s) => s.active && s.name === "local")).toBe(true);
  });

  it("status 未初始化 → initialized=false（可读，不抛错）", () => {
    const empty = mkdtempSync(join(tmpdir(), "doclight-space-empty-"));
    try {
      const status = spaceStatus(empty);
      expect(status.initialized).toBe(false);
      expect(status.spaces).toHaveLength(1);
      expect(status.spaces[0]?.name).toBe("local");
    } finally {
      rmSync(empty, { recursive: true, force: true });
    }
  });

  it("配置损坏时 status 视为未初始化（不崩栈）", () => {
    const broken = mkdtempSync(join(tmpdir(), "doclight-space-broken-"));
    try {
      mkdirSync(join(broken, ".doclight"), { recursive: true });
      writeFileSync(join(broken, ".doclight", "space.json"), "{ not json");
      const status = spaceStatus(broken);
      expect(status.initialized).toBe(false);
      expect(loadSpaceConfig(broken)).toBeNull();
    } finally {
      rmSync(broken, { recursive: true, force: true });
    }
  });
});
