// qrcode 模块类型声明（C2 bundle 二维码；避免引入 @types/qrcode 外部依赖）
declare module "qrcode" {
  export function toFile(path: string, text: string, options?: unknown): Promise<void>;
  export function toDataURL(text: string, options?: unknown): Promise<string>;
  export function toBuffer(text: string, options?: unknown): Promise<Buffer>;
}
