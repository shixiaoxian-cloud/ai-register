import type { Page, BrowserContext } from "@playwright/test";

/**
 * 高级反检测脚本 - 顶级配置
 * 包含所有已知的浏览器指纹对抗措施
 */
export async function injectAdvancedStealthScripts(page: Page): Promise<void> {
  await page.addInitScript(() => {
    // ============================================
    // 1. WebDriver 检测对抗
    // ============================================

    // 删除 navigator.webdriver
    Object.defineProperty(navigator, "webdriver", {
      get: () => undefined,
      configurable: true
    });

    // 删除 window.document.__selenium_unwrapped
    delete (window.document as any).__selenium_unwrapped;
    delete (window.document as any).__webdriver_evaluate;
    delete (window.document as any).__driver_evaluate;
    delete (window.document as any).__webdriver_script_function;
    delete (window.document as any).__webdriver_script_func;
    delete (window.document as any).__webdriver_script_fn;
    delete (window.document as any).__fxdriver_evaluate;
    delete (window.document as any).__driver_unwrapped;
    delete (window.document as any).__webdriver_unwrapped;
    delete (window.document as any).__fxdriver_unwrapped;
    delete (window.document as any).__selenium_evaluate;
    delete (window.document as any).__selenium_evaluate__;

    // ============================================
    // 2. User Agent Data 完整伪造
    // ============================================

    if (navigator.userAgentData) {
      Object.defineProperty(navigator, "userAgentData", {
        get: () => ({
          brands: [
            { brand: "Chromium", version: "146" },
            { brand: "Not-A.Brand", version: "24" },
            { brand: "Google Chrome", version: "146" }
          ],
          mobile: false,
          platform: "Windows",
          getHighEntropyValues: async (hints: string[]) => {
            const values: any = {
              architecture: "x86",
              bitness: "64",
              brands: [
                { brand: "Chromium", version: "146" },
                { brand: "Not-A.Brand", version: "24" },
                { brand: "Google Chrome", version: "146" }
              ],
              fullVersionList: [
                { brand: "Chromium", version: "146.0.6478.127" },
                { brand: "Not-A.Brand", version: "24.0.0.0" },
                { brand: "Google Chrome", version: "146.0.6478.127" }
              ],
              mobile: false,
              model: "",
              platform: "Windows",
              platformVersion: "15.0.0",
              uaFullVersion: "146.0.6478.127",
              wow64: false
            };
            return values;
          }
        }),
        configurable: true
      });
    }

    // ============================================
    // 3. Chrome 对象完整伪造
    // ============================================

    if (!window.chrome) {
      (window as any).chrome = {};
    }

    // 删除 chrome.runtime（扩展检测）
    Object.defineProperty(window.chrome, "runtime", {
      get: () => undefined,
      configurable: true
    });

    // 添加 chrome.loadTimes（真实浏览器有）
    if (!window.chrome.loadTimes) {
      window.chrome.loadTimes = () => ({
        commitLoadTime: Date.now() / 1000 - Math.random() * 2,
        connectionInfo: "http/1.1",
        finishDocumentLoadTime: Date.now() / 1000 - Math.random(),
        finishLoadTime: Date.now() / 1000 - Math.random() * 0.5,
        firstPaintAfterLoadTime: 0,
        firstPaintTime: Date.now() / 1000 - Math.random() * 1.5,
        navigationType: "Other",
        npnNegotiatedProtocol: "h2",
        requestTime: Date.now() / 1000 - Math.random() * 3,
        startLoadTime: Date.now() / 1000 - Math.random() * 2.5,
        wasAlternateProtocolAvailable: false,
        wasFetchedViaSpdy: true,
        wasNpnNegotiated: true
      });
    }

    // 添加 chrome.csi（真实浏览器有）
    if (!window.chrome.csi) {
      window.chrome.csi = () => ({
        onloadT: Date.now(),
        pageT: Math.random() * 1000 + 1000,
        startE: Date.now() - Math.random() * 3000,
        tran: 15
      });
    }

    // 添加 chrome.app（真实浏览器有）
    if (!window.chrome.app) {
      window.chrome.app = {
        isInstalled: false,
        InstallState: { DISABLED: "disabled", INSTALLED: "installed", NOT_INSTALLED: "not_installed" },
        RunningState: { CANNOT_RUN: "cannot_run", READY_TO_RUN: "ready_to_run", RUNNING: "running" }
      };
    }

    // ============================================
    // 4. Plugins 完整伪造
    // ============================================

    Object.defineProperty(navigator, "plugins", {
      get: () => {
        const plugins = [
          {
            0: { type: "application/x-google-chrome-pdf", suffixes: "pdf", description: "Portable Document Format" },
            description: "Portable Document Format",
            filename: "internal-pdf-viewer",
            length: 1,
            name: "Chrome PDF Plugin",
            item: (index: number) => plugins[0][index as keyof typeof plugins[0]],
            namedItem: (name: string) => null
          },
          {
            0: { type: "application/pdf", suffixes: "pdf", description: "" },
            description: "",
            filename: "mhjfbmdgcfjbbpaeojofohoefgiehjai",
            length: 1,
            name: "Chrome PDF Viewer",
            item: (index: number) => plugins[1][index as keyof typeof plugins[1]],
            namedItem: (name: string) => null
          },
          {
            0: { type: "application/x-nacl", suffixes: "", description: "Native Client Executable" },
            1: { type: "application/x-pnacl", suffixes: "", description: "Portable Native Client Executable" },
            description: "",
            filename: "internal-nacl-plugin",
            length: 2,
            name: "Native Client",
            item: (index: number) => plugins[2][index as keyof typeof plugins[2]],
            namedItem: (name: string) => null
          }
        ];

        Object.setPrototypeOf(plugins, PluginArray.prototype);
        return plugins;
      },
      configurable: true
    });

    // ============================================
    // 5. MimeTypes 完整伪造
    // ============================================

    Object.defineProperty(navigator, "mimeTypes", {
      get: () => {
        const mimeTypes = [
          { type: "application/pdf", suffixes: "pdf", description: "Portable Document Format", enabledPlugin: null },
          { type: "application/x-google-chrome-pdf", suffixes: "pdf", description: "Portable Document Format", enabledPlugin: null },
          { type: "application/x-nacl", suffixes: "", description: "Native Client Executable", enabledPlugin: null },
          { type: "application/x-pnacl", suffixes: "", description: "Portable Native Client Executable", enabledPlugin: null }
        ];

        Object.setPrototypeOf(mimeTypes, MimeTypeArray.prototype);
        return mimeTypes;
      },
      configurable: true
    });

    // ============================================
    // 6. Languages 伪造
    // ============================================

    Object.defineProperty(navigator, "languages", {
      get: () => ["en-US", "en"],
      configurable: true
    });

    // ============================================
    // 7. Permissions API 修复
    // ============================================

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

    // ============================================
    // 8. Battery API 伪造
    // ============================================

    if (!navigator.getBattery) {
      (navigator as any).getBattery = () =>
        Promise.resolve({
          charging: true,
          chargingTime: 0,
          dischargingTime: Infinity,
          level: 0.95 + Math.random() * 0.05,
          addEventListener: () => {},
          removeEventListener: () => {},
          dispatchEvent: () => true
        });
    }

    // ============================================
    // 9. Connection API 伪造
    // ============================================

    if (navigator.connection) {
      Object.defineProperty(navigator.connection, "rtt", {
        get: () => Math.floor(Math.random() * 50) + 30,
        configurable: true
      });

      Object.defineProperty(navigator.connection, "downlink", {
        get: () => Math.random() * 5 + 5,
        configurable: true
      });

      Object.defineProperty(navigator.connection, "effectiveType", {
        get: () => "4g",
        configurable: true
      });
    }

    // ============================================
    // 10. Hardware Concurrency 随机化
    // ============================================

    Object.defineProperty(navigator, "hardwareConcurrency", {
      get: () => [4, 8, 12, 16][Math.floor(Math.random() * 4)],
      configurable: true
    });

    // ============================================
    // 11. Device Memory 随机化
    // ============================================

    Object.defineProperty(navigator, "deviceMemory", {
      get: () => [4, 8, 16][Math.floor(Math.random() * 3)],
      configurable: true
    });

    // ============================================
    // 12. Screen 属性一致性
    // ============================================

    Object.defineProperty(screen, "availWidth", {
      get: () => 1440,
      configurable: true
    });

    Object.defineProperty(screen, "availHeight", {
      get: () => 900,
      configurable: true
    });

    // ============================================
    // 13. Canvas 指纹噪声注入
    // ============================================

    const originalToDataURL = HTMLCanvasElement.prototype.toDataURL;
    HTMLCanvasElement.prototype.toDataURL = function(type?: string, quality?: any) {
      const context = this.getContext("2d");
      if (context) {
        const imageData = context.getImageData(0, 0, this.width, this.height);
        for (let i = 0; i < imageData.data.length; i += 4) {
          if (Math.random() < 0.001) {
            imageData.data[i] = (imageData.data[i] + Math.floor(Math.random() * 3) - 1) % 256;
            imageData.data[i + 1] = (imageData.data[i + 1] + Math.floor(Math.random() * 3) - 1) % 256;
            imageData.data[i + 2] = (imageData.data[i + 2] + Math.floor(Math.random() * 3) - 1) % 256;
          }
        }
        context.putImageData(imageData, 0, 0);
      }
      return originalToDataURL.apply(this, [type, quality]);
    };

    const originalGetImageData = CanvasRenderingContext2D.prototype.getImageData;
    CanvasRenderingContext2D.prototype.getImageData = function(...args) {
      const imageData = originalGetImageData.apply(this, args);
      for (let i = 0; i < imageData.data.length; i += 4) {
        if (Math.random() < 0.001) {
          imageData.data[i] = (imageData.data[i] + Math.floor(Math.random() * 3) - 1) % 256;
          imageData.data[i + 1] = (imageData.data[i + 1] + Math.floor(Math.random() * 3) - 1) % 256;
          imageData.data[i + 2] = (imageData.data[i + 2] + Math.floor(Math.random() * 3) - 1) % 256;
        }
      }
      return imageData;
    };

    // ============================================
    // 14. WebGL 指纹噪声注入
    // ============================================

    const getParameter = WebGLRenderingContext.prototype.getParameter;
    WebGLRenderingContext.prototype.getParameter = function(parameter) {
      if (parameter === 37445) { // UNMASKED_VENDOR_WEBGL
        return "Intel Inc.";
      }
      if (parameter === 37446) { // UNMASKED_RENDERER_WEBGL
        return "Intel Iris OpenGL Engine";
      }
      return getParameter.apply(this, [parameter]);
    };

    // ============================================
    // 15. AudioContext 指纹噪声注入
    // ============================================

    const audioContext = (window as any).AudioContext || (window as any).webkitAudioContext;
    if (audioContext) {
      const originalCreateOscillator = audioContext.prototype.createOscillator;
      audioContext.prototype.createOscillator = function() {
        const oscillator = originalCreateOscillator.apply(this);
        const originalStart = oscillator.start;
        oscillator.start = function(...args: any[]) {
          const noise = Math.random() * 0.0001 - 0.00005;
          if (oscillator.frequency) {
            oscillator.frequency.value += noise;
          }
          return originalStart.apply(this, args);
        };
        return oscillator;
      };
    }

    // ============================================
    // 16. Date 对象时间偏移（防止时区检测）
    // ============================================

    const originalDate = Date;
    const originalGetTimezoneOffset = Date.prototype.getTimezoneOffset;
    Date.prototype.getTimezoneOffset = function() {
      return -480; // UTC-8 (Los Angeles)
    };

    // ============================================
    // 17. Notification API 伪造
    // ============================================

    if (window.Notification) {
      Object.defineProperty(Notification, "permission", {
        get: () => "default",
        configurable: true
      });
    }

    // ============================================
    // 18. 删除 Playwright 特征
    // ============================================

    delete (navigator as any).__playwright;
    delete (window as any).__playwright;
    delete (window as any).__pw_manual;
    delete (window as any).__PW_inspect;

    // ============================================
    // 19. 修复 iframe 检测
    // ============================================

    Object.defineProperty(window, "outerWidth", {
      get: () => window.innerWidth,
      configurable: true
    });

    Object.defineProperty(window, "outerHeight", {
      get: () => window.innerHeight,
      configurable: true
    });

    // ============================================
    // 20. 修复 toString 检测
    // ============================================

    const originalToString = Function.prototype.toString;
    Function.prototype.toString = function() {
      if (this === navigator.webdriver) {
        return "function webdriver() { [native code] }";
      }
      return originalToString.apply(this);
    };
  });
}

/**
 * 人类行为模拟 - 随机延迟
 */
export async function humanDelay(min: number = 500, max: number = 2000): Promise<void> {
  const delay = Math.random() * (max - min) + min;
  await new Promise(resolve => setTimeout(resolve, delay));
}

/**
 * 人类行为模拟 - 鼠标移动
 */
export async function humanMouseMove(page: Page): Promise<void> {
  const x = Math.random() * 200 + 100;
  const y = Math.random() * 200 + 100;

  await page.mouse.move(x, y, { steps: Math.floor(Math.random() * 10) + 5 });
  await humanDelay(100, 500);
}

/**
 * 人类行为模拟 - 缓慢输入
 */
export async function humanType(page: Page, selector: string, text: string): Promise<void> {
  const element = page.locator(selector);

  // Try regular click first, then force click if intercepted
  try {
    await element.click({ timeout: 5000 });
  } catch (error) {
    console.log('[HumanType] Regular click failed, trying force click...');
    await element.click({ force: true });
  }

  await humanDelay(200, 500);

  for (const char of text) {
    await element.pressSequentially(char, { delay: Math.random() * 100 + 50 });
  }

  await humanDelay(300, 800);
}

/**
 * 拦截并阻止所有遥测请求
 */
export async function blockAllTelemetry(page: Page): Promise<void> {
  await page.route("**/*", (route) => {
    const url = route.request().url();

    // 阻止已知的遥测端点
    const telemetryPatterns = [
      "/ces/v1/t",
      "/v1/events",
      "/analytics",
      "/telemetry",
      "/track",
      "/collect",
      "google-analytics.com",
      "googletagmanager.com",
      "doubleclick.net",
      "segment.io",
      "segment.com"
    ];

    if (telemetryPatterns.some(pattern => url.includes(pattern))) {
      route.abort();
    } else {
      route.continue();
    }
  });
}

/**
 * 设置真实的浏览器指纹
 */
export async function setupRealisticFingerprint(context: BrowserContext): Promise<void> {
  // 设置地理位置
  await context.setGeolocation({
    latitude: 34.0522,  // Los Angeles
    longitude: -118.2437,
    accuracy: 100
  });

  // 设置额外的 HTTP 头
  await context.setExtraHTTPHeaders({
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
    "Accept-Encoding": "gzip, deflate, br",
    "Accept-Language": "en-US,en;q=0.9",
    "Cache-Control": "max-age=0",
    "Sec-Fetch-Dest": "document",
    "Sec-Fetch-Mode": "navigate",
    "Sec-Fetch-Site": "none",
    "Sec-Fetch-User": "?1",
    "Upgrade-Insecure-Requests": "1"
  });
}

// 保留原有的基础函数以保持向后兼容
export { injectAdvancedStealthScripts as injectStealthScripts };
export { blockAllTelemetry as blockTelemetryRequests };
