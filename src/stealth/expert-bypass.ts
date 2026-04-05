import type { Page, BrowserContext } from "@playwright/test";

/**
 * 专家级反检测方案 - 针对 Cloudflare 高级 Bot 管理
 * 基于实际测试结果优化
 */

/**
 * 增强的人类行为模拟 - 更自然的延迟
 */
export async function naturalDelay(min: number = 2000, max: number = 5000): Promise<void> {
  // 使用正态分布而不是均匀分布
  const mean = (min + max) / 2;
  const stdDev = (max - min) / 6;

  let delay = mean + stdDev * (Math.random() + Math.random() + Math.random() - 1.5);
  delay = Math.max(min, Math.min(max, delay));

  await new Promise(resolve => setTimeout(resolve, delay));
}

/**
 * 真实的鼠标移动 - 贝塞尔曲线
 */
export async function realisticMouseMove(page: Page, targetX?: number, targetY?: number): Promise<void> {
  const viewport = page.viewportSize() || { width: 1440, height: 900 };

  const startX = Math.random() * viewport.width;
  const startY = Math.random() * viewport.height;
  const endX = targetX || Math.random() * viewport.width;
  const endY = targetY || Math.random() * viewport.height;

  // 贝塞尔曲线控制点
  const cp1x = startX + (endX - startX) * 0.3 + (Math.random() - 0.5) * 100;
  const cp1y = startY + (endY - startY) * 0.3 + (Math.random() - 0.5) * 100;
  const cp2x = startX + (endX - startX) * 0.7 + (Math.random() - 0.5) * 100;
  const cp2y = startY + (endY - startY) * 0.7 + (Math.random() - 0.5) * 100;

  const steps = Math.floor(Math.random() * 20) + 30;

  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const t2 = t * t;
    const t3 = t2 * t;
    const mt = 1 - t;
    const mt2 = mt * mt;
    const mt3 = mt2 * mt;

    const x = mt3 * startX + 3 * mt2 * t * cp1x + 3 * mt * t2 * cp2x + t3 * endX;
    const y = mt3 * startY + 3 * mt2 * t * cp1y + 3 * mt * t2 * cp2y + t3 * endY;

    await page.mouse.move(x, y);
    await new Promise(resolve => setTimeout(resolve, Math.random() * 10 + 5));
  }
}

/**
 * 模拟真实的页面滚动
 */
export async function realisticScroll(page: Page): Promise<void> {
  const scrolls = Math.floor(Math.random() * 3) + 2;

  for (let i = 0; i < scrolls; i++) {
    const scrollAmount = Math.floor(Math.random() * 300) + 100;
    await page.mouse.wheel(0, scrollAmount);
    await naturalDelay(800, 1500);
  }
}

/**
 * 模拟真实的页面停留
 */
export async function realisticPageStay(page: Page, extended: boolean = false): Promise<void> {
  // 随机移动鼠标 2-3 次（减少）
  const moves = Math.floor(Math.random() * 2) + 2;
  for (let i = 0; i < moves; i++) {
    await realisticMouseMove(page);
    await naturalDelay(800, 1500);
  }

  // 滚动 1 次
  if (Math.random() > 0.5) {
    await realisticScroll(page);
  }

  // 停留时间
  if (extended) {
    // 首页停留 5-8 秒（大幅减少）
    await naturalDelay(5000, 8000);
  } else {
    await naturalDelay(2000, 3000);
  }
}

/**
 * 通过点击导航而不是直接跳转
 */
export async function navigateByClick(page: Page, selector: string): Promise<void> {
  const element = page.locator(selector).first();

  // 移动鼠标到元素
  const box = await element.boundingBox();
  if (box) {
    await realisticMouseMove(page, box.x + box.width / 2, box.y + box.height / 2);
    await naturalDelay(500, 1000);
  }

  // 点击
  await element.click();
  await naturalDelay(1000, 2000);
}

/**
 * 检测 Cloudflare 拦截页面
 */
export async function detectCloudflareBlock(page: Page): Promise<boolean> {
  const bodyText = await page.locator('body').innerText().catch(() => '');

  const blockIndicators = [
    'Incompatible browser extension',
    'network configuration',
    'challenges.cloudflare.com',
    'security verification process',
    'Just a moment',
    'Checking your browser',
    'Please wait'
  ];

  return blockIndicators.some(indicator => bodyText.includes(indicator));
}

/**
 * 等待页面加载（不使用 networkidle）
 */
export async function waitForPageLoad(page: Page, timeout: number = 30000): Promise<void> {
  await page.waitForLoadState('domcontentloaded', { timeout });
  await naturalDelay(3000, 5000);

  // 检查是否被拦截
  const isBlocked = await detectCloudflareBlock(page);
  if (isBlocked) {
    console.log('[Cloudflare] ⚠️ Page is blocked, waiting longer...');
    await naturalDelay(10000, 15000);
  }
}

/**
 * 完整的 Cloudflare 绕过流程
 */
export async function bypassCloudflare(
  page: Page,
  context: BrowserContext,
  targetUrl: string
): Promise<boolean> {
  const url = new URL(targetUrl);
  const homepageUrl = `${url.protocol}//${url.host}`;

  console.log('[Cloudflare] Starting bypass procedure...');

  // 1. 访问首页
  console.log('[Cloudflare] Step 1: Visit homepage');
  await page.goto(homepageUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await naturalDelay(2000, 3000);

  // 2. 检查是否被拦截
  let isBlocked = await detectCloudflareBlock(page);
  if (isBlocked) {
    console.log('[Cloudflare] Homepage is blocked, waiting for verification...');
    await naturalDelay(10000, 15000);
    isBlocked = await detectCloudflareBlock(page);

    if (isBlocked) {
      console.log('[Cloudflare] ❌ Still blocked after waiting');
      return false;
    }
  }

  // 3. 模拟真实用户行为（首页停留更长时间）
  console.log('[Cloudflare] Step 2: Simulate real user behavior');
  await realisticPageStay(page, true);

  // 4. 检查 cookie
  const cookies = await context.cookies();
  const cfClearance = cookies.find(c => c.name === 'cf_clearance');
  const cfBm = cookies.find(c => c.name === '__cf_bm');

  console.log(`[Cloudflare] cf_clearance: ${cfClearance ? '✓' : '✗'}`);
  console.log(`[Cloudflare] __cf_bm: ${cfBm ? '✓' : '✗'}`);

  if (!cfClearance) {
    console.log('[Cloudflare] ⚠️ No cf_clearance cookie, may fail');
  }

  // 5. 通过点击导航到目标页面（如果可能）
  console.log('[Cloudflare] Step 3: Navigate to target page');

  const loginButton = page.locator('a[href*="/auth/login"], button:has-text("Log in")').first();
  const hasLoginButton = await loginButton.isVisible().catch(() => false);

  if (hasLoginButton) {
    console.log('[Cloudflare] Clicking login button...');
    await navigateByClick(page, 'a[href*="/auth/login"], button:has-text("Log in")');
  } else {
    console.log('[Cloudflare] No login button, direct navigation...');
    await naturalDelay(1000, 2000);
    await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
  }

  // 6. 等待目标页面加载
  await waitForPageLoad(page);

  // 7. 检查目标页面是否被拦截
  isBlocked = await detectCloudflareBlock(page);
  if (isBlocked) {
    console.log('[Cloudflare] ❌ Target page is blocked');
    return false;
  }

  console.log('[Cloudflare] ✓ Bypass successful');
  return true;
}
