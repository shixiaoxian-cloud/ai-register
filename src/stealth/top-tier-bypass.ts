import type { Page, BrowserContext } from "@playwright/test";

/**
 * 顶级反检测方案 - 基于最新研究
 * 针对 OpenAI/ChatGPT 的高级检测机制
 */

/**
 * 修复 Sec-CH-UA 客户端提示头
 * OpenAI 会验证这些头的一致性
 */
export async function fixClientHints(context: BrowserContext): Promise<void> {
  await context.setExtraHTTPHeaders({
    'sec-ch-ua': '"Chromium";v="131", "Not_A Brand";v="24", "Google Chrome";v="131"',
    'sec-ch-ua-mobile': '?0',
    'sec-ch-ua-platform': '"Windows"',
    'sec-ch-ua-platform-version': '"15.0.0"',
    'sec-ch-ua-arch': '"x86"',
    'sec-ch-ua-bitness': '"64"',
    'sec-ch-ua-model': '""',
    'sec-ch-ua-full-version-list': '"Chromium";v="131.0.6778.86", "Not_A Brand";v="24.0.0.0", "Google Chrome";v="131.0.6778.86"'
  });
}

/**
 * 深度 JavaScript 环境修复
 * 修复所有可能被检测的 API
 */
export async function deepJavaScriptFix(page: Page): Promise<void> {
  await page.addInitScript(() => {
    // 1. 完全删除 WebDriver 痕迹
    Object.defineProperty(navigator, 'webdriver', {
      get: () => undefined,
      configurable: true
    });

    // 2. 修复 Permissions API
    const originalQuery = window.navigator.permissions.query;
    window.navigator.permissions.query = (parameters: any) => {
      if (parameters.name === 'notifications') {
        return Promise.resolve({
          state: Notification.permission,
          onchange: null,
          addEventListener: () => {},
          removeEventListener: () => {},
          dispatchEvent: () => true
        } as any);
      }
      return originalQuery(parameters);
    };

    // 3. 修复 Chrome 对象
    if (!window.chrome) {
      (window as any).chrome = {};
    }

    Object.defineProperty(window, 'chrome', {
      get: () => ({
        runtime: undefined,
        loadTimes: function() {
          const now = performance.now() / 1000;
          return {
            commitLoadTime: now - 2,
            connectionInfo: 'http/1.1',
            finishDocumentLoadTime: now - 1,
            finishLoadTime: now - 0.5,
            firstPaintAfterLoadTime: 0,
            firstPaintTime: now - 1.5,
            navigationType: 'Other',
            npnNegotiatedProtocol: 'h2',
            requestTime: now - 3,
            startLoadTime: now - 2.5,
            wasAlternateProtocolAvailable: false,
            wasFetchedViaSpdy: true,
            wasNpnNegotiated: true
          };
        },
        csi: function() {
          return {
            onloadT: Date.now(),
            pageT: Date.now() - 2000,
            startE: Date.now() - 3000,
            tran: 15
          };
        },
        app: {
          isInstalled: false,
          InstallState: {
            DISABLED: 'disabled',
            INSTALLED: 'installed',
            NOT_INSTALLED: 'not_installed'
          },
          RunningState: {
            CANNOT_RUN: 'cannot_run',
            READY_TO_RUN: 'ready_to_run',
            RUNNING: 'running'
          }
        }
      }),
      configurable: true
    });

    // 4. 修复 Plugins
    Object.defineProperty(navigator, 'plugins', {
      get: () => {
        const plugins = [
          {
            0: { type: 'application/x-google-chrome-pdf', suffixes: 'pdf', description: 'Portable Document Format' },
            description: 'Portable Document Format',
            filename: 'internal-pdf-viewer',
            length: 1,
            name: 'Chrome PDF Plugin',
            item: (index: number) => plugins[0][index as any],
            namedItem: () => null
          },
          {
            0: { type: 'application/pdf', suffixes: 'pdf', description: '' },
            description: '',
            filename: 'mhjfbmdgcfjbbpaeojofohoefgiehjai',
            length: 1,
            name: 'Chrome PDF Viewer',
            item: (index: number) => plugins[1][index as any],
            namedItem: () => null
          },
          {
            0: { type: 'application/x-nacl', suffixes: '', description: 'Native Client Executable' },
            1: { type: 'application/x-pnacl', suffixes: '', description: 'Portable Native Client Executable' },
            description: '',
            filename: 'internal-nacl-plugin',
            length: 2,
            name: 'Native Client',
            item: (index: number) => plugins[2][index as any],
            namedItem: () => null
          }
        ];
        Object.setPrototypeOf(plugins, PluginArray.prototype);
        return plugins;
      },
      configurable: true
    });

    // 5. 修复 Languages
    Object.defineProperty(navigator, 'languages', {
      get: () => ['en-US', 'en'],
      configurable: true
    });

    // 6. 删除所有 Playwright 痕迹
    delete (window as any).__playwright;
    delete (window as any).__pw_manual;
    delete (window as any).__PW_inspect;
    delete (navigator as any).__playwright;
    delete (window as any).__playwright_evaluation_script__;

    // 7. 修复 iframe 检测
    Object.defineProperty(window, 'outerWidth', {
      get: () => window.innerWidth,
      configurable: true
    });
    Object.defineProperty(window, 'outerHeight', {
      get: () => window.innerHeight,
      configurable: true
    });

    // 8. 修复 Error.stack
    const OriginalError = Error;
    (window as any).Error = class extends OriginalError {
      constructor(message?: string) {
        super(message);
        if (this.stack) {
          this.stack = this.stack
            .split('\n')
            .filter(line =>
              !line.includes('playwright') &&
              !line.includes('puppeteer') &&
              !line.includes('__playwright') &&
              !line.includes('evaluateHandle')
            )
            .join('\n');
        }
      }
    };

    // 9. 修复 Function.toString
    const originalToString = Function.prototype.toString;
    Function.prototype.toString = function() {
      if (this === navigator.webdriver) {
        return 'function webdriver() { [native code] }';
      }
      const result = originalToString.apply(this);
      return result.replace(/playwright|puppeteer|selenium/gi, '');
    };

    // 10. 修复 Date.prototype.getTimezoneOffset
    const originalGetTimezoneOffset = Date.prototype.getTimezoneOffset;
    Date.prototype.getTimezoneOffset = function() {
      return -480; // UTC+8 (Los Angeles is UTC-8, so return -480)
    };

    // 11. 添加 Battery API
    if (!navigator.getBattery) {
      (navigator as any).getBattery = () => Promise.resolve({
        charging: true,
        chargingTime: 0,
        dischargingTime: Infinity,
        level: 0.95 + Math.random() * 0.05,
        addEventListener: () => {},
        removeEventListener: () => {},
        dispatchEvent: () => true
      });
    }

    // 12. 修复 Connection API
    if (navigator.connection) {
      Object.defineProperty(navigator.connection, 'rtt', {
        get: () => Math.floor(Math.random() * 50) + 30,
        configurable: true
      });
      Object.defineProperty(navigator.connection, 'downlink', {
        get: () => Math.random() * 5 + 5,
        configurable: true
      });
      Object.defineProperty(navigator.connection, 'effectiveType', {
        get: () => '4g',
        configurable: true
      });
    }

    // 13. 修复 hardwareConcurrency
    Object.defineProperty(navigator, 'hardwareConcurrency', {
      get: () => 8,
      configurable: true
    });

    // 14. 修复 deviceMemory
    Object.defineProperty(navigator, 'deviceMemory', {
      get: () => 8,
      configurable: true
    });

    // 15. 修复 maxTouchPoints
    Object.defineProperty(navigator, 'maxTouchPoints', {
      get: () => 0,
      configurable: true
    });

    // 16. 修复 vendor
    Object.defineProperty(navigator, 'vendor', {
      get: () => 'Google Inc.',
      configurable: true
    });

    // 17. 修复 platform
    Object.defineProperty(navigator, 'platform', {
      get: () => 'Win32',
      configurable: true
    });

    // 18. 修复 userAgentData
    if (navigator.userAgentData) {
      Object.defineProperty(navigator, 'userAgentData', {
        get: () => ({
          brands: [
            { brand: 'Chromium', version: '131' },
            { brand: 'Not_A Brand', version: '24' },
            { brand: 'Google Chrome', version: '131' }
          ],
          mobile: false,
          platform: 'Windows',
          getHighEntropyValues: async (hints: string[]) => ({
            architecture: 'x86',
            bitness: '64',
            brands: [
              { brand: 'Chromium', version: '131' },
              { brand: 'Not_A Brand', version: '24' },
              { brand: 'Google Chrome', version: '131' }
            ],
            fullVersionList: [
              { brand: 'Chromium', version: '131.0.6778.86' },
              { brand: 'Not_A Brand', version: '24.0.0.0' },
              { brand: 'Google Chrome', version: '131.0.6778.86' }
            ],
            mobile: false,
            model: '',
            platform: 'Windows',
            platformVersion: '15.0.0',
            uaFullVersion: '131.0.6778.86',
            wow64: false
          })
        }),
        configurable: true
      });
    }
  });
}

/**
 * 完整的顶级反检测设置
 */
export async function setupTopTierAntiDetection(
  page: Page,
  context: BrowserContext
): Promise<void> {
  // 1. 修复客户端提示头
  await fixClientHints(context);

  // 2. 深度 JavaScript 环境修复
  await deepJavaScriptFix(page);

  // 3. 设置地理位置
  await context.setGeolocation({
    latitude: 34.0522,
    longitude: -118.2437,
    accuracy: 100
  });
}
