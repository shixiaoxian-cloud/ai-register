/**
 * JWT Token 解码工具
 * 用于从 JWT token 中提取 payload 信息
 */

export interface JWTPayload {
  [key: string]: any;
}

/**
 * 解码 JWT token 的 payload 部分
 * @param token JWT token 字符串
 * @returns 解码后的 payload 对象，解码失败返回空对象
 */
export function decodeJWTPayload(token: string): JWTPayload {
  if (!token || typeof token !== 'string') {
    return {};
  }

  try {
    const parts = token.split('.');
    if (parts.length !== 3) {
      return {};
    }

    // JWT payload 是第二部分
    const payload = parts[1];

    // Base64URL 解码
    const base64 = payload.replace(/-/g, '+').replace(/_/g, '/');
    const paddedBase64 = base64.padEnd(base64.length + (4 - base64.length % 4) % 4, '=');

    const jsonString = Buffer.from(paddedBase64, 'base64').toString('utf8');
    return JSON.parse(jsonString);
  } catch (error) {
    console.warn('JWT 解码失败:', error);
    return {};
  }
}

/**
 * 从 token data 中提取 ChatGPT 账号 ID
 */
export function extractChatGPTAccountId(authData: any): string {
  if (!authData || typeof authData !== 'object') {
    return '';
  }

  return String(
    authData.chatgpt_account_id ||
    authData.account_id ||
    ''
  ).trim();
}

/**
 * 从 access token 中提取完整的认证信息
 */
export function extractAuthInfo(accessToken: string) {
  const claims = decodeJWTPayload(accessToken);
  const auth = claims['https://api.openai.com/auth'] || {};
  const profile = claims['https://api.openai.com/profile'] || {};

  return {
    email: String(profile.email || claims.email || '').trim(),
    emailVerified: Boolean(profile.email_verified),
    accountId: extractChatGPTAccountId(auth),
    userId: String(auth.chatgpt_user_id || auth.user_id || '').trim(),
    organizationId: extractOrganizationId(auth),
    expiresAt: typeof claims.exp === 'number' ? claims.exp : 0,
  };
}

/**
 * 从认证数据中提取组织 ID
 */
function extractOrganizationId(authData: any): string {
  if (!authData || typeof authData !== 'object') {
    return '';
  }

  const orgs = authData.organizations;
  if (Array.isArray(orgs) && orgs.length > 0) {
    const firstOrg = orgs[0];
    if (firstOrg && typeof firstOrg === 'object') {
      return String(firstOrg.id || '').trim();
    }
  }

  return '';
}
