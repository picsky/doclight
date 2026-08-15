import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";

const outDir = "c:\\Users\\87854\\Desktop\\doclight\\.design_library\\doclight";
const componentsDir = join(outDir, "components");
mkdirSync(componentsDir, { recursive: true });

const components = [
  {
    slug: "article",
    data: {
      schemaVersion: "2",
      name: "Article 正文排版",
      category: "content",
      sourceKind: "from-scratch",
      confidence: "high",
      semanticTypeCandidates: ["article", "prose", "reading"],
      variantDimensions: [
        { name: "theme", values: ["light", "dark"], defaultValue: "light" },
        { name: "density", values: ["normal", "compact"], defaultValue: "normal" }
      ],
      representativeVariants: [
        {
          name: "默认长文",
          whySelected: "覆盖文档站 90% 页面：标题层级 + 段落 + 列表",
          traits: {
            fontSize: "var(--font-size-body)",
            lineHeight: "var(--line-height-relaxed)",
            maxWidth: "680px",
            color: "var(--color-text)",
            headingColor: "var(--color-text-strong)"
          },
          childrenDigest: ["h1", "h2", "h3", "p", "ul", "ol"]
        }
      ],
      anatomy: [
        { name: "heading", purpose: "章节锚点与信息分层" },
        { name: "paragraph", purpose: "正文阅读主体" },
        { name: "list", purpose: "步骤或枚举" },
        { name: "link", purpose: "内部/外部跳转" }
      ],
      structurePatterns: ["single-column reading rhythm", "anchor ids for TOC", "max-width constraint"],
      usageHints: {
        priorityHint: "high",
        whenToUse: "所有文档页面主体内容区",
        whenNotToUse: "不要用于营销卡片或仪表盘面板"
      },
      doNotInvent: ["非文档组件如轮播、Hero"],
      unknowns: [],
      keyInsightSeed: "16px × 1.75 行高，680px 行宽，中文阅读甜点区",
      renderPlan: { samples: ["default"] },
      visualSpecs: {
        primary: {
          fontFamily: "var(--font-sans)",
          fontSize: "var(--font-size-body)",
          lineHeight: "var(--line-height-relaxed)",
          color: "var(--color-text)",
          maxWidth: "680px",
          padding: "var(--space-8)"
        },
        states: {}
      },
      sourceSignals: {
        uiCopySamples: ["快速开始", "API 参考", "安装指南"]
      }
    }
  },
  {
    slug: "blockquote",
    data: {
      schemaVersion: "2",
      name: "Blockquote 引用块",
      category: "content",
      sourceKind: "from-scratch",
      confidence: "high",
      semanticTypeCandidates: ["blockquote", "quotation", "callout"],
      variantDimensions: [
        { name: "theme", values: ["light", "dark"], defaultValue: "light" }
      ],
      representativeVariants: [
        {
          name: "默认引用",
          whySelected: "文档中引用外部观点或强调注意",
          traits: {
            borderLeft: "3px solid var(--color-primary)",
            paddingLeft: "var(--space-4)",
            color: "var(--color-text-secondary)"
          },
          childrenDigest: ["p"]
        }
      ],
      anatomy: [
        { name: "left-bar", purpose: "视觉标识引用" },
        { name: "text", purpose: "引用正文" }
      ],
      structurePatterns: ["left accent border", "indent without italics"],
      usageHints: {
        priorityHint: "medium",
        whenToUse: "引用他人观点、特别提示"
      },
      doNotInvent: ["作者头像、引号图标装饰"],
      unknowns: [],
      keyInsightSeed: "左侧 3px 主色竖线 + 弱化文字，不抢正文节奏",
      renderPlan: { samples: ["default"] },
      visualSpecs: {
        primary: {
          borderLeft: "3px solid var(--color-primary)",
          paddingLeft: "var(--space-4)",
          margin: "var(--space-6) 0",
          color: "var(--color-text-secondary)",
          fontSize: "var(--font-size-body)",
          lineHeight: "var(--line-height-relaxed)"
        },
        states: {}
      },
      sourceSignals: {
        uiCopySamples: ["这是一条引用文字。"]
      }
    }
  },
  {
    slug: "table",
    data: {
      schemaVersion: "2",
      name: "Table 表格",
      category: "content",
      sourceKind: "from-scratch",
      confidence: "high",
      semanticTypeCandidates: ["table", "data-table", "markdown-table"],
      variantDimensions: [
        { name: "theme", values: ["light", "dark"], defaultValue: "light" },
        { name: "style", values: ["minimal", "card"], defaultValue: "minimal" }
      ],
      representativeVariants: [
        {
          name: "极简表格",
          whySelected: "默认文档表格，横向分隔线、无竖线",
          traits: {
            border: "1px solid var(--color-border)",
            headerBackground: "var(--color-bg-soft)",
            fontVariantNumeric: "tabular-nums"
          },
          childrenDigest: ["thead", "tbody", "tr", "th", "td"]
        }
      ],
      anatomy: [
        { name: "header", purpose: "列标题" },
        { name: "row", purpose: "数据行" },
        { name: "cell", purpose: "单元格" }
      ],
      structurePatterns: ["horizontal rules only", "overflow scroll", "tabular nums"],
      usageHints: {
        priorityHint: "high",
        whenToUse: "参数表、对比表、数据说明"
      },
      doNotInvent: ["排序按钮、分页、行选择器"],
      unknowns: [],
      keyInsightSeed: "横向分隔线、表头深一级、数字 tabular-nums 对齐",
      renderPlan: { samples: ["default"] },
      visualSpecs: {
        primary: {
          width: "100%",
          borderCollapse: "collapse",
          fontSize: "var(--font-size-body)",
          color: "var(--color-text)",
          borderBottom: "1px solid var(--color-border)"
        },
        states: {}
      },
      sourceSignals: {
        uiCopySamples: ["参数", "类型", "默认值", "说明"]
      }
    }
  },
  {
    slug: "code-block",
    data: {
      schemaVersion: "2",
      name: "Code Block 代码块",
      category: "content",
      sourceKind: "from-scratch",
      confidence: "high",
      semanticTypeCandidates: ["pre", "code", "code-block"],
      variantDimensions: [
        { name: "theme", values: ["light", "dark"], defaultValue: "light" }
      ],
      representativeVariants: [
        {
          name: "默认代码块",
          whySelected: "技术文档最高频元素",
          traits: {
            background: "var(--color-bg-code)",
            borderRadius: "var(--radius)",
            fontFamily: "var(--font-mono)",
            fontSize: "0.875rem"
          },
          childrenDigest: ["pre", "code", "copy-button", "lang-label"]
        }
      ],
      anatomy: [
        { name: "pre", purpose: "代码块容器" },
        { name: "code", purpose: "语法高亮代码" },
        { name: "lang-label", purpose: "语言标识" },
        { name: "copy-button", purpose: "复制代码" }
      ],
      structurePatterns: ["scrollable pre", "hover-reveal copy button", "language label top-right"],
      usageHints: {
        priorityHint: "high",
        whenToUse: "代码示例、配置文件、命令行"
      },
      doNotInvent: ["行号、执行按钮"],
      unknowns: [],
      keyInsightSeed: "语言标签 + 复制按钮 hover 浮现，深色玻璃 / 浅灰底双主题",
      renderPlan: { samples: ["default"] },
      visualSpecs: {
        primary: {
          background: "var(--color-bg-code)",
          color: "var(--color-text)",
          borderRadius: "var(--radius)",
          padding: "var(--space-4) var(--space-5)",
          fontFamily: "var(--font-mono)",
          fontSize: "0.875rem",
          lineHeight: "1.6",
          overflow: "auto"
        },
        states: {}
      },
      sourceSignals: {
        uiCopySamples: ["bash", "json", "typescript"]
      }
    }
  },
  {
    slug: "container",
    data: {
      schemaVersion: "2",
      name: "Container 提示容器",
      category: "content",
      sourceKind: "from-scratch",
      confidence: "high",
      semanticTypeCandidates: ["container", "callout", "alert"],
      variantDimensions: [
        { name: "theme", values: ["light", "dark"], defaultValue: "light" },
        { name: "type", values: ["tip", "info", "warning", "danger"], defaultValue: "tip" }
      ],
      representativeVariants: [
        {
          name: "tip",
          whySelected: "文档最常用的提示类型",
          traits: {
            borderLeft: "4px solid var(--color-primary)",
            background: "var(--color-bg-soft)",
            icon: "✓"
          },
          childrenDigest: ["title", "content"]
        },
        {
          name: "warning",
          whySelected: "需要引起注意的警告信息",
          traits: {
            borderLeft: "4px solid var(--color-warning)",
            background: "var(--color-bg-soft)",
            icon: "⚠"
          },
          childrenDigest: ["title", "content"]
        }
      ],
      anatomy: [
        { name: "icon", purpose: "语义图标" },
        { name: "title", purpose: "容器标题" },
        { name: "content", purpose: "提示正文" }
      ],
      structurePatterns: ["left semantic bar", "soft background", "icon + title + body"],
      usageHints: {
        priorityHint: "high",
        whenToUse: "tip/info/warning/danger 提示"
      },
      doNotInvent: ["关闭按钮、展开收起"],
      unknowns: [],
      keyInsightSeed: "左侧语义色竖条 + 图标，四种状态清晰可辨",
      renderPlan: { samples: ["tip", "warning"] },
      visualSpecs: {
        primary: {
          background: "var(--color-bg-soft)",
          borderRadius: "var(--radius)",
          padding: "var(--space-4) var(--space-5)",
          borderLeft: "4px solid var(--color-primary)",
          color: "var(--color-text)"
        },
        states: {}
      },
      sourceSignals: {
        uiCopySamples: ["提示", "注意", "警告"]
      }
    }
  },
  {
    slug: "navigation",
    data: {
      schemaVersion: "2",
      name: "Navigation 导航",
      category: "navigation",
      sourceKind: "from-scratch",
      confidence: "high",
      semanticTypeCandidates: ["nav", "sidebar", "topbar", "toc"],
      variantDimensions: [
        { name: "theme", values: ["light", "dark"], defaultValue: "light" },
        { name: "viewport", values: ["desktop", "mobile"], defaultValue: "desktop" }
      ],
      representativeVariants: [
        {
          name: "桌面三栏",
          whySelected: "文档站标准布局：顶栏 + 侧边栏 + TOC",
          traits: {
            topbarHeight: "64px",
            sidebarWidth: "280px",
            activeIndicator: "3px teal left bar"
          },
          childrenDigest: ["topbar", "sidebar", "toc"]
        }
      ],
      anatomy: [
        { name: "topbar", purpose: "品牌与全局搜索" },
        { name: "sidebar", purpose: "文档分组导航" },
        { name: "toc", purpose: "当前页面大纲" }
      ],
      structurePatterns: ["sticky topbar", "scrollable sidebar", "active item highlight"],
      usageHints: {
        priorityHint: "high",
        whenToUse: "文档站全局导航"
      },
      doNotInvent: ["多级折叠动画、面包屑动态加载"],
      unknowns: [],
      keyInsightSeed: "顶栏毛玻璃 + 侧边栏当前项 teal 竖线 + TOC 导轨",
      renderPlan: { samples: ["desktop"] },
      visualSpecs: {
        primary: {
          topbarHeight: "64px",
          sidebarWidth: "280px",
          background: "var(--color-bg-soft)",
          borderColor: "var(--color-border)",
          activeColor: "var(--color-primary)"
        },
        states: {}
      },
      sourceSignals: {
        uiCopySamples: ["文档", "API", "主题", "搜索文档"]
      }
    }
  }
];

const index = {
  components: components.map((c) => ({
    slug: c.slug,
    name: c.data.name,
    category: c.data.category,
    sourceKind: c.data.sourceKind,
    confidence: c.data.confidence,
    variantCount: c.data.variantDimensions?.length ?? 0,
    priorityHint: c.data.usageHints?.priorityHint,
    keyInsightSeed: c.data.keyInsightSeed
  }))
};

writeFileSync(join(componentsDir, "index.json"), JSON.stringify(index, null, 2));
for (const c of components) {
  writeFileSync(join(componentsDir, `${c.slug}.json`), JSON.stringify(c.data, null, 2));
}

console.log("Wrote", components.length + 1, "component files.");
