/**
 * doclight preview —— 预览 SSG 构建产物（05-ssg-build §5.2.1，PREVIEW-001）
 *
 * 纯静态文件服务器（零重写）：直接服务 dist-site 产物。
 * - / → index.html（首页）
 * - 站内链接 /guide/foo.html 原样命中
 * - 无扩展名 / .md 请求回退到对应 .html（兼容手工输入）
 * - base 子路径部署（build --base）时，剥离前缀后匹配产物（GitHub Pages 项目页预览）
 * 路径穿越防护：任何请求路径解析后必须落在产物根目录内。
 */
import { createServer, type Server, type ServerResponse } from "node:http";
import { readFileSync, statSync } from "node:fs";
import { extname, join, resolve, sep } from "node:path";
import { mimeFor } from "./site.ts";

export interface PreviewServerOptions {
  /** 构建产物目录（doclight build 输出） */
  dir: string;
  port?: number;
  host?: string;
  /** 子路径基址（与 build --base 对应，如 "/docs"）：请求带该前缀时剥离后匹配 */
  base?: string;
}

export interface PreviewServer {
  url: string;
  port: number;
  close(): Promise<void>;
}

function tryStat(p: string): ReturnType<typeof statSync> | null {
  try {
    return statSync(p);
  } catch {
    return null;
  }
}

function send404(res: ServerResponse, message: string): void {
  res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
  res.end(message);
}

/** 启动 preview 服务器。port 缺省用 0（系统分配，便于测试）；返回后即可请求。 */
export async function startPreviewServer(options: PreviewServerOptions): Promise<PreviewServer> {
  const root = resolve(options.dir);
  const host = options.host ?? "127.0.0.1";

  const server: Server = createServer((req, res) => {
    const urlPath = req.url ?? "/";
    const withoutQuery = urlPath.split("?")[0]!.split("#")[0]!;
    let rel: string;
    try {
      rel = decodeURIComponent(withoutQuery).replace(/^\/+/, "");
    } catch {
      send404(res, "路径解码失败");
      return;
    }
    // 子路径部署：剥离 base 前缀后匹配产物（根部署时 basePath 为空，行为不变）
    const basePath = (options.base ?? "").replace(/^\/+/, "").replace(/\/+$/, "");
    if (basePath && (rel === basePath || rel.startsWith(`${basePath}/`))) {
      rel = rel.slice(basePath.length).replace(/^\/+/, "");
    }
    if (rel === "") rel = "index.html";

    // 路径穿越防护
    const resolved = resolve(root, rel);
    if (!resolved.startsWith(root + sep) && resolved !== root) {
      send404(res, "路径越界");
      return;
    }

    // 1) 直接命中；2) 无扩展名 / .md 请求回退到 .html（SSG 产物 URL 约定）
    let target = resolved;
    let stat = tryStat(target);
    const ext = extname(target).toLowerCase();
    if (!(stat?.isFile() ?? false) && (ext === "" || ext === ".md")) {
      target = join(root, rel.replace(/\.md$/, "") + ".html");
      stat = tryStat(target);
    }

    if (stat?.isFile() ?? false) {
      try {
        res.writeHead(200, { "Content-Type": mimeFor(target) });
        res.end(readFileSync(target));
      } catch {
        send404(res, `读取失败：${urlPath}`);
      }
    } else {
      send404(res, `未找到：${urlPath}`);
    }
  });

  await new Promise<void>((resolveListen) => {
    server.listen(options.port ?? 0, host, () => resolveListen());
  });
  const address = server.address();
  const port = typeof address === "object" && address ? address.port : (options.port ?? 0);

  return {
    url: `http://${host}:${port}/`,
    port,
    close: () =>
      new Promise<void>((done) => {
        server.close(() => done());
      }),
  };
}
