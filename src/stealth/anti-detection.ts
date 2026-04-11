// @ts-nocheck

import type { Page } from "@playwright/test";

/**
 * 注入反检测脚本到页面上下文
 * 在页面加载前调用，隐藏自动化特征
 */
export async function injectStealthScripts(page: Page): Promise<void> {
  await page.addInitScript(() => {
    // 1. 删除 navigator.webdriver 标志
    Object.defineProperty(navigator, "webdriver", {
      get: () => undefined,
      configurable: true
    });

    // 2. 修改 navigator.userAgentData 使其更真实
    if (navigator.userAgentData) {
      Object.defineProperty(navigator, "userAgentData", {
        get: () => ({
          brands: [
            { brand: "Chromium", version: "146" },
            { brand: "Not-A.Brand", version: "24" },
            { brand: "Google Chrome", version: "146" }
          ],
          mobile: false,
          platform: "Windows"
        }),
        configurable: true
      });
    }

    // 3. 修改 navigator.plugins 使其看起来更真实
    Object.defineProperty(navigator, "plugins", {
      get: () => [
        {
          0: {
            type: "application/x-google-chrome-pdf",
            suffixes: "pdf",
            description: "Portable Document Format",
            enabledPlugin: null
          },
          description: "Portable Document Format",
          filename: "internal-pdf-viewer",
          length: 1,
          name: "Chrome PDF Plugin"
        },
        {
          0: {
            type: "application/pdf",
            suffixes: "pdf",
            description: "",
            enabledPlugin: null
          },
          description: "",
          filename: "mhjfbmdgcfjbbpaeojofohoefgiehjai",
          length: 1,
          name: "Chrome PDF Viewer"
        },
        {
          0: {
            type: "application/x-nacl",
            suffixes: "",
            description: "Native Client Executable",
            enabledPlugin: null
          },
          1: {
            type: "application/x-pnacl",
            suffixes: "",
            description: "Portable Native Client Executable",
            enabledPlugin: null
          },
          description: "",
          filename: "internal-nacl-plugin",
          length: 2,
          name: "Native Client"
        }
      ]
    });

    // 4. 修改 navigator.languages 使其更真实
    Object.defineProperty(navigator, "languages", {
      get: () => ["en-US", "en"],
      configurable: true
    });

    // 5. 覆盖 chrome.runtime 检测
    if (window.chrome) {
      Object.defineProperty(window.chrome, "runtime", {
        get: () => undefined,
        configurable: true
      });
    }

    // 6. 修改 permissions API 行为
    const originalQuery = window.navigator.permissions.query;
    window.navigator.permissions.query = (parameters: any) =>
      parameters.name === "notifications"
        ? Promise.resolve({
            state: Notification.permission as PermissionState,
            onchange: null,
            addEventListener: () => {},
            removeEventListener: () => {},
            dispatchEvent: () => true
          } as PermissionStatus)
        : originalQuery(parameters);

    // 7. 伪造 battery API（自动化浏览器通常没有）
    if (!navigator.getBattery) {
      (navigator as any).getBattery = () =>
        Promise.resolve({
          charging: true,
          chargingTime: 0,
          dischargingTime: Infinity,
          level: 1.0,
          addEventListener: () => {},
          removeEventListener: () => {},
          dispatchEvent: () => true
        });
    }

    // 8. 修改 connection API
    if (navigator.connection) {
      Object.defineProperty(navigator.connection, "rtt", {
        get: () => 50,
        configurable: true
      });
    }
  });
}

/**
 * 拦截并阻止发往 ChatGPT 遥测端点的请求
 */
export async function blockTelemetryRequests(page: Page): Promise<void> {
  await page.route("**/ces/v1/t", (route) => {
    route.abort();
  });
}

/**
 * 拦截并修改发往 ChatGPT 遥测端点的请求
 * 移除敏感的指纹数据
 */
export async function modifyTelemetryRequests(page: Page): Promise<void> {
  await page.route("**/ces/v1/t", async (route) => {
    const request = route.request();

    try {
      const postData = request.postData();
      if (!postData) {
        await route.continue();
        return;
      }

      const payload = JSON.parse(postData);

      // 移除 Performance API 相关的敏感数据
      if (payload.properties?.eventParams) {
        delete payload.properties.eventParams.transferSizeBytes;
        delete payload.properties.eventParams.encodedBodySizeBytes;
        delete payload.properties.eventParams.decodedBodySizeBytes;
      }

      await route.continue({
        postData: JSON.stringify(payload)
      });
    } catch (error) {
      // 如果解析失败，直接放行
      await route.continue();
    }
  });
}

/**
 * 记录发往 ChatGPT 遥测端点的请求（用于调试）
 */
export async function logTelemetryRequests(page: Page): Promise<void> {
  await page.route("**/ces/v1/t", async (route) => {
    const request = route.request();
    const postData = request.postData();

    if (postData) {
      try {
        const payload = JSON.parse(postData);
        console.log("[Telemetry Request]", JSON.stringify(payload, null, 2));
      } catch (error) {
        console.log("[Telemetry Request] Failed to parse:", postData.substring(0, 200));
      }
    }

    await route.continue();
  });
}
