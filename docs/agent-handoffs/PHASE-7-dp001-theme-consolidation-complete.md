# PHASE-7 DP-001 交接 · 主题收敛（单主题做精）

> 任务：DP-001 单主题收敛（18-design-polish §3.1）。换会话先读本文件 + 18-design-polish.md。

## 一句话总结

DocLight 内置主题从 4 套收敛为**唯一一套**（default = minimal，松绿 Pine 设计语言）：
serif / modern / warm 三套完全退役（文件删除 + 注册表移除 + 旧配置值警告降级默认）；
用户自定义 CSS 主题机制（THEME-002）原样保留；画廊/合规门禁/视觉基线全部收敛到单主题。

## 用户决策（不可回退）

「关于主题，我们只做一套，把一套做好做精。」——完全退役三套内置主题（用户已确认）；
其余优化方向（品牌/阅读状态/内容纵深/导航/动效/AI 身份）全部通过，按 18-design-polish 顺序推进。

## 改动清单

**核心（packages/cli/src/）**
- `themes.ts`：BUILTIN_THEME_PACKAGES 收敛为 `[{minimal}]`；新增 `RETIRED_THEMES`（serif/modern/warm）
  ——resolveThemePackage 对退役名输出「已退役」专属警告并降级默认（区别于笼统未知主题）；注释全面更新
- `themes/{serif,modern,warm}.css`：**删除**
- `gallery.ts`：themeMeta 收敛为 minimal 单条目（「唯一内置主题」）；索引页 hint 文案 4 套→1 套

**门禁与测试**
- `scripts/checks/visual.mjs`：BUILTIN_THEMES → ["minimal"]；画廊期望文件数 9→3
- `scripts/visual-regression.spec.ts`：THEMES → ["minimal"]；24 组截图→6 组（1 主题 × 亮暗 × 3 断点）
- `packages/cli/test/themes.test.ts`：重写——唯一内置主题断言 / 退役清单 / 退役警告降级（含 buildSite 端到端）/
  自定义 CSS 路径加载（机制保留）/ renderPage 注入回归；14 例
- `packages/cli/test/gallery.test.ts`：产物 3 文件 / minimal 面板 fixedTheme / build --themes 回归；5 例
- `packages/cli/test/design-compliance.test.ts`：modern 暗色优先结构断言 → minimal 亮色优先结构断言；10 例

**规格与文档**
- `specs/features/theme.feature`：内置主题注册表 = 唯一 minimal + 退役警告降级场景
- `specs/features/visual.feature`：单主题收敛场景 + 画廊 3 HTML + 基线 6 张
- `docs/themes.md`：重写——唯一内置主题 + 退役说明 + 自定义 CSS 主题包 + 宪法令牌清单 + 合规门禁
- `docs/component-gallery.md`：主题 = token 层段落更新（单主题 + 6 组基线）
- `docs/migration-from-mkdocs.md`：theme 对照行更新
- `docs/tech-design/11-default-themes.md`：标注历史存档（🗄️ DP-001）
- `docs/tech-design/16-design-system.md`：状态与上游引用更新
- `docs/tech-design/18-design-polish.md`：DP-001 检查项勾选

**视觉基线**
- 删除 `artifacts/visual/snapshots/gallery-{serif,modern,warm}-*.png`（18 张）
- `npm run verify:visual:update` 重拍：minimal × 亮暗 × 3 断点 6 张 + slides 2 张

## 验证状态

- `npx vitest run packages/cli packages/display`：38 文件 **334 通过 / 1 环境跳过**
- `npm run verify`：**8/8 全绿**（lint / typecheck / test / size / contract / e2e / visual / smoke）
- `npm run verify:visual:update`：8 张基线重拍完成（连续稳定）
- CLI bundle 重建 + dist-site 重建（56 篇）+ 9000 端口 dev server 重启（harness/lesson 站点正常）

## 遗留与注意

- **slides 演示形态的 warm 主题**是独立设计系统（dark/light/warm），**不在 DP-001 收敛范围**（18 §3 红线外）
- 旧配置 `theme: "serif"|"modern"|"warm"` → 构建警告「已退役」+ 降级默认（零注入），不报错中断
- 自定义 CSS 主题包（含 `defaultTheme:"dark"` 暗色优先）机制完整保留——THEME-002 是插件生态能力
- 画廊改造（多主题面板 → 单主题设计宣言页）与 DP-007 的 component-gallery 升级**合并落地**（18 §3.7）

## 下一步

DP-002 品牌层（18 §3.2）：标志三形态 + 签名时刻 + 首页 hero + 空态系统 + 微文案 tone。
