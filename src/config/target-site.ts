import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

export interface TargetSiteConfig {
  startUrl: string;
  updatedAt?: string;
}

export const TARGET_SITE_CONFIG_PATH = path.resolve(
  process.cwd(),
  "config",
  "target-site.json"
);

export function validateHttpsUrl(input: string): string {
  let parsed: URL;

  try {
    parsed = new URL(input);
  } catch {
    throw new Error(`测试站点地址格式无效：${input}`);
  }

  if (parsed.protocol !== "https:") {
    throw new Error("测试站点地址必须使用 https:// 协议。");
  }

  if (!parsed.hostname) {
    throw new Error("测试站点地址必须包含有效域名。");
  }

  return parsed.toString();
}

export function readTargetSiteConfig(): TargetSiteConfig {
  if (!existsSync(TARGET_SITE_CONFIG_PATH)) {
    return {
      startUrl: "",
      updatedAt: ""
    };
  }

  const rawText = readFileSync(TARGET_SITE_CONFIG_PATH, "utf8");
  const parsed = JSON.parse(rawText) as Partial<TargetSiteConfig>;

  return {
    startUrl: parsed.startUrl?.trim() ?? "",
    updatedAt: parsed.updatedAt ?? ""
  };
}

export function getConfiguredStartUrl(): string {
  const config = readTargetSiteConfig();

  if (!config.startUrl) {
    throw new Error(
      `尚未配置测试站点地址。请先运行 npm run config:ui，并在浏览器界面中保存一个 https:// 地址。`
    );
  }

  return validateHttpsUrl(config.startUrl);
}

