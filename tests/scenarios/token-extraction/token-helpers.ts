/**
 * Token 提取模块
 * 负责从页面中提取和保存 access token
 */

import type { Page, TestInfo } from "@playwright/test";
import { requireEnv } from "../../../src/env";
import { humanDelay } from "../../../src/stealth/advanced-stealth";
import { saveTokenToMultipleFormats } from "../../../src/utils/token-saver";
import type { TokenData } from "../../../src/utils/token-saver";
import type { Mailbox } from "../../../src/email/temp-mail";

export interface TokenExtractionResult {
  success: boolean;
  accessToken?: string;
  sessionToken?: string;
  savedPaths?: {
    cpa?: string;
    sub2api?: string;
  };
}

/**
 * 从 cookies 中提取 session token
 */
async function extractSessionToken(page: Page): Promise<string> {
  const cookies = await page.context().cookies();
  console.log(`[Token] Found ${cookies.length} cookies`);

  let sessionToken = '';
  for (const cookie of cookies) {
    if (cookie.name === '__Secure-next-auth.session-token' || cookie.name === 'next-auth.session-token') {
      console.log(`[Token] Found session token: ${cookie.name}`);
      sessionToken = cookie.value;
      break;
    }
  }

  return sessionToken;
}

/**
 * 通过 API 获取 access token
 */
async function fetchAccessTokenFromAPI(page: Page): Promise<{
  accessToken: string;
  refreshToken: string;
  idToken: string;
} | null> {
  try {
    console.log('[Token] Attempting to fetch access token via API...');
    const response = await page.evaluate(async () => {
      try {
        const res = await fetch('https://chatgpt.com/api/auth/session', {
          method: 'GET',
          credentials: 'include'
        });
        if (res.ok) {
          return await res.json();
        }
        return null;
      } catch (e) {
        return null;
      }
    });

    if (response && response.accessToken) {
      console.log('[Token] ✓ Successfully fetched access token from API');
      return {
        accessToken: response.accessToken,
        refreshToken: response.refreshToken || '',
        idToken: response.idToken || ''
      };
    }

    console.log('[Token] API returned no access token');
    return null;
  } catch (error) {
    console.log('[Token] Failed to fetch access token from API:', error);
    return null;
  }
}

/**
 * 从页面存储中提取 token
 */
async function extractTokensFromPage(page: Page): Promise<{
  accessToken: string;
  refreshToken: string;
  idToken: string;
}> {
  return await page.evaluate(() => {
    // 方法 1: 从 localStorage 获取
    let accessToken = localStorage.getItem('accessToken') ||
                     localStorage.getItem('access_token') || '';
    let refreshToken = localStorage.getItem('refreshToken') ||
                      localStorage.getItem('refresh_token') || '';
    let idToken = localStorage.getItem('idToken') ||
                 localStorage.getItem('id_token') || '';

    // 方法 2: 从 cookies 获取
    if (!accessToken) {
      const cookies = document.cookie.split(';');
      for (const cookie of cookies) {
        const [name, value] = cookie.trim().split('=');
        if (name === '__Secure-next-auth.session-token' || name === 'next-auth.session-token') {
          accessToken = decodeURIComponent(value);
        }
      }
    }

    // 方法 3: 从 __NEXT_DATA__ 获取
    if (!accessToken) {
      try {
        const nextData = document.getElementById('__NEXT_DATA__');
        if (nextData) {
          const data = JSON.parse(nextData.textContent || '{}');
          const props = data?.props?.pageProps;
          if (props?.accessToken) accessToken = props.accessToken;
          if (props?.refreshToken) refreshToken = props.refreshToken;
          if (props?.idToken) idToken = props.idToken;
        }
      } catch (e) {
        // Ignore parsing errors
      }
    }

    return {
      accessToken: accessToken,
      refreshToken: refreshToken,
      idToken: idToken
    };
  });
}

/**
 * 提取并保存 token
 */
export async function extractAndSaveTokens(
  page: Page,
  testInfo: TestInfo,
  userInfo: { password: string },
  tempMailbox: Mailbox | null
): Promise<TokenExtractionResult> {
  try {
    console.log('[Token] Registration completed, attempting to extract tokens...');

    // 等待页面稳定
    await humanDelay(2000, 3000);

    // 尝试从 cookies 中提取 session token
    let sessionToken = await extractSessionToken(page);

    // 初始化 tokens 对象
    let tokens = {
      accessToken: '',
      refreshToken: '',
      idToken: ''
    };

    // 如果有 session token，尝试通过 API 获取 access token
    if (sessionToken) {
      const apiTokens = await fetchAccessTokenFromAPI(page);
      if (apiTokens) {
        tokens = apiTokens;
      }
    } else {
      console.log('[Token] No session token found, trying alternative methods...');

      // 尝试导航到主页来获取 session token
      try {
        console.log('[Token] Navigating to ChatGPT home to get session...');
        await page.goto('https://chatgpt.com/', { waitUntil: 'domcontentloaded', timeout: 15000 });
        await humanDelay(2000, 3000);

        sessionToken = await extractSessionToken(page);

        if (sessionToken) {
          const apiTokens = await fetchAccessTokenFromAPI(page);
          if (apiTokens) {
            tokens = apiTokens;
          }
        }
      } catch (error) {
        console.log('[Token] Failed to navigate to home page:', error);
      }
    }

    // 如果还没有 token，尝试从页面中提取
    if (!tokens.accessToken) {
      const pageTokens = await extractTokensFromPage(page);
      if (pageTokens.accessToken) {
        tokens = pageTokens;
      }
    }

    if (tokens.accessToken) {
      console.log('[Token] ✓ Access token found');

      const tokenData: TokenData = {
        email: tempMailbox?.full_address || requireEnv("TARGET_EMAIL"),
        password: userInfo.password,
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        idToken: tokens.idToken
      };

      // 保存到本地文件（CPA 和 Sub2Api 格式）
      const outputDir = process.env.TOKEN_OUTPUT_DIR || './output_tokens';
      const requestedRunCount = Number(process.env.PLATFORM_RUN_COUNT || '1');
      const executionLabel =
        requestedRunCount > 1 ? `run-${testInfo.repeatEachIndex + 1}` : undefined;
      const savedPaths = await saveTokenToMultipleFormats(tokenData, outputDir, {
        fileLabel: executionLabel
      });

      if (savedPaths.cpa) {
        console.log(`[Token] ✓ CPA format saved: ${savedPaths.cpa}`);
      }
      if (savedPaths.sub2api) {
        console.log(`[Token] ✓ Sub2Api format saved: ${savedPaths.sub2api}`);
      }

      // 附加 token 信息到测试报告
      await testInfo.attach("tokens.json", {
        body: Buffer.from(JSON.stringify({
          email: tokenData.email,
          hasAccessToken: !!tokenData.accessToken,
          hasRefreshToken: !!tokenData.refreshToken,
          hasIdToken: !!tokenData.idToken,
          savedPaths: savedPaths
        }, null, 2), "utf8"),
        contentType: "application/json"
      });

      return {
        success: true,
        accessToken: tokens.accessToken,
        savedPaths
      };
    } else if (sessionToken) {
      console.log('[Token] ✓ Session token found in cookies');
      console.log(`[Token] Session token: ${sessionToken.substring(0, 20)}...`);

      // 保存 session token 信息
      await testInfo.attach("session-info.json", {
        body: Buffer.from(JSON.stringify({
          email: tempMailbox?.full_address || requireEnv("TARGET_EMAIL"),
          password: userInfo.password,
          sessionToken: sessionToken,
          note: "Session token found in cookies - may need to exchange for access token"
        }, null, 2), "utf8"),
        contentType: "application/json"
      });

      return {
        success: true,
        sessionToken
      };
    } else {
      console.log('[Token] ⚠ No access token found in page storage');
      console.log('[Token] ℹ This may be normal - ChatGPT uses session-based auth');
      return { success: false };
    }
  } catch (error) {
    console.error('[Token] Failed to extract or save tokens:', error);
    return { success: false };
  }
}
