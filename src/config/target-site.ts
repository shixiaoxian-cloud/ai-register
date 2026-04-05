import { readActivePlatformContext } from "./platform-sqlite";

export interface TargetSiteConfig {
  startUrl: string;
  updatedAt?: string;
}

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
  const context = readActivePlatformContext();

  return {
    startUrl: context.site.startUrl.trim(),
    updatedAt: context.site.updatedAt
  };
}

export function getConfiguredStartUrl(): string {
  const config = readTargetSiteConfig();

  if (!config.startUrl) {
    throw new Error(
      "当前活动方案尚未配置测试站点地址。请先运行 npm run config:ui，并在控制台保存一个 https:// 地址。"
    );
  }

  return validateHttpsUrl(config.startUrl);
}
