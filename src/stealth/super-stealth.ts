// @ts-nocheck

import type { Page, BrowserContext } from "@playwright/test";

/**
 * 超级隐身模式 - 针对严格的反爬虫检测
 * 专门用于绕过 403 Forbidden 错误
 */
export async function injectSuperStealthScripts(page: Page): Promise<void> {
  // 在导航前注入
  await page.addInitScript(() => {
    // 1. 完全移除所有自动化痕迹
    Object.defineProperty(navigator, "webdriver", {
      get: () => undefined
    });

    // 2. 修复 Chrome 对象
    if (!window.chrome) {
      (window as any).chrome = {};
    }

    (window as any).chrome = {
      runtime: undefined,
      loadTimes: function() {
        return {
          commitLoadTime: performance.now() / 1000,
          connectionInfo: "http/1.1",
          finishDocumentLoadTime: performance.now() / 1000,
          finishLoadTime: performance.now() / 1000,
          firstPaintAfterLoadTime: 0,
          firstPaintTime: performance.now() / 1000,
          navigationType: "Other",
          npnNegotiatedProtocol: "h2",
          requestTime: 0,
          startLoadTime: performance.now() / 1000,
          wasAlternateProtocolAvailable: false,
          wasFetchedViaSpdy: true,
          wasNpnNegotiated: true
        };
      },
      csi: function() {
        return {
          onloadT: Date.now(),
          pageT: Date.now(),
          startE: Date.now(),
          tran: 15
        };
      },
      app: {
        isInstalled: false
      }
    };

    // 3. 修复 Permissions API
    const originalQuery = window.navigator.permissions.query;
    window.navigator.permissions.query = (parameters: any) => {
      if (parameters.name === "notifications") {
        return Promise.resolve({
          state: Notification.permission,
          onchange: null
        } as any);
      }
      return originalQuery(parameters);
    };

    // 4. 添加真实的 plugins
    Object.defineProperty(navigator, "plugins", {
      get: () => {
        return [
          {
            0: {
              type: "application/x-google-chrome-pdf",
              suffixes: "pdf",
              description: "Portable Document Format"
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
              description: ""
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
              description: "Native Client Executable"
            },
            1: {
              type: "application/x-pnacl",
              suffixes: "",
              description: "Portable Native Client Executable"
            },
            description: "",
            filename: "internal-nacl-plugin",
            length: 2,
            name: "Native Client"
          }
        ];
      }
    });

    // 5. 修复 languages
    Object.defineProperty(navigator, "languages", {
      get: () => ["en-US", "en"]
    });

    // 6. 删除所有 Playwright 痕迹
    delete (window as any).__playwright;
    delete (window as any).__pw_manual;
    delete (window as any).__PW_inspect;
    delete (navigator as any).__playwright;

    // 7. 修复 window.chrome 检测
    Object.defineProperty(window, "chrome", {
      get: () => ({
        runtime: undefined,
        loadTimes: (window as any).chrome.loadTimes,
        csi: (window as any).chrome.csi,
        app: (window as any).chrome.app
      }),
      configurable: true
    });

    // 8. 覆盖 toString 以隐藏修改痕迹
    const originalToString = Function.prototype.toString;
    Function.prototype.toString = function() {
      if (this === navigator.webdriver) {
        return "function webdriver() { [native code] }";
      }
      return originalToString.call(this);
    };
  });
}

/**
 * 设置真实浏览器的 HTTP 头
 */
export async function setRealisticHeaders(context: BrowserContext): Promise<void> {
  await context.setExtraHTTPHeaders({
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7",
    "Accept-Encoding": "gzip, deflate, br, zstd",
    "Accept-Language": "en-US,en;q=0.9",
    "Cache-Control": "max-age=0",
    "Sec-Ch-Ua": '"Chromium";v="146", "Not.A/Brand";v="24", "Google Chrome";v="146"',
    "Sec-Ch-Ua-Mobile": "?0",
    "Sec-Ch-Ua-Platform": '"Windows"',
    "Sec-Fetch-Dest": "document",
    "Sec-Fetch-Mode": "navigate",
    "Sec-Fetch-Site": "none",
    "Sec-Fetch-User": "?1",
    "Upgrade-Insecure-Requests": "1"
  });
}

/**
 * 添加随机延迟以模拟人类行为
 */
export async function randomDelay(min: number = 1000, max: number = 3000): Promise<void> {
  const delay = Math.floor(Math.random() * (max - min + 1)) + min;
  await new Promise(resolve => setTimeout(resolve, delay));
}

/**
 * 完整的反检测设置
 */
export async function setupAntiDetection(page: Page, context: BrowserContext): Promise<void> {
  // 1. 注入超级隐身脚本
  await injectSuperStealthScripts(page);

  // 2. 设置真实的 HTTP 头
  await setRealisticHeaders(context);

  // 3. 设置地理位置
  await context.setGeolocation({
    latitude: 34.0522,
    longitude: -118.2437,
    accuracy: 100
  });
}
