/**
 * Token 保存模块
 * 支持 Sub2Api 和 CPA 格式的 token 保存
 */

import * as fs from 'fs';
import * as path from 'path';
import { extractAuthInfo, decodeJWTPayload } from './jwt-decoder';

export interface TokenData {
  email: string;
  password: string;
  accessToken: string;
  refreshToken: string;
  idToken: string;
}

export interface Sub2ApiAccount {
  name: string;
  notes: string;
  platform: string;
  type: string;
  credentials: {
    access_token: string;
    refresh_token: string;
    expires_in: number;
    expires_at: number;
    chatgpt_account_id: string;
    chatgpt_user_id: string;
    organization_id: string;
    client_id: string;
    model_mapping: Record<string, string>;
  };
  extra: {
    email: string;
    password: string;
  };
  group_ids: number[];
  concurrency: number;
  priority: number;
  rate_multiplier: number;
  auto_pause_on_expired: boolean;
}

export interface Sub2ApiPayload {
  proxies: any[];
  accounts: Sub2ApiAccount[];
}

export interface CPAPayload {
  type: string;
  name: string;
  provider: string;
  platform: string;
  email: string;
  email_verified: boolean;
  expired: string;
  id_token: string;
  account_id: string;
  accountId: string;
  chatgpt_account_id: string;
  chatgptAccountId: string;
  chatgpt_user_id: string;
  chatgptUserId: string;
  organization_id: string;
  organizationId: string;
  access_token: string;
  last_refresh: string;
  refresh_token: string;
  credentials: {
    access_token: string;
    refresh_token: string;
    id_token: string;
    expires_at: number;
    expires_in: number;
    chatgpt_account_id: string;
    chatgpt_user_id: string;
    organization_id: string;
  };
  extra: {
    email: string;
    account_id: string;
    chatgpt_account_id: string;
    chatgpt_user_id: string;
  };
  token_info: {
    access_token: string;
    refresh_token: string;
    id_token: string;
    account_id: string;
    chatgpt_account_id: string;
    chatgpt_user_id: string;
    expires_at: number;
  };
}

/**
 * 构建 Sub2Api 格式的 payload
 */
export function buildSub2ApiPayload(
  tokenData: TokenData,
  options: {
    groupIds?: number[];
    concurrency?: number;
    priority?: number;
    autoPauseOnExpired?: boolean;
  } = {}
): Sub2ApiPayload | null {
  const { accessToken, refreshToken, idToken, email, password } = tokenData;

  if (!accessToken) {
    console.warn('Sub2Api 格式需要 access_token');
    return null;
  }

  // 即使没有 refresh_token 也生成 Sub2Api 格式（字段为空）
  if (!refreshToken) {
    console.warn('Sub2Api: refresh_token 为空，但仍然生成格式');
  }

  const authInfo = extractAuthInfo(accessToken);
  const groupIds = options.groupIds || [2];
  const concurrency = options.concurrency || 10;
  const priority = options.priority || 1;
  const autoPauseOnExpired = options.autoPauseOnExpired ?? true;

  return {
    proxies: [],
    accounts: [
      {
        name: email || authInfo.accountId || 'openai-account',
        notes: '',
        platform: 'openai',
        type: 'oauth',
        credentials: {
          access_token: accessToken,
          refresh_token: refreshToken,
          expires_in: 863999,
          expires_at: authInfo.expiresAt,
          chatgpt_account_id: authInfo.accountId,
          chatgpt_user_id: authInfo.userId,
          organization_id: authInfo.organizationId,
          client_id: 'app_EMoamEEZ73f0CkXaXp7hrann',
          model_mapping: {
            'gpt-5.1': 'gpt-5.1',
            'gpt-5.1-codex': 'gpt-5.1-codex',
            'gpt-5.1-codex-max': 'gpt-5.1-codex-max',
            'gpt-5.1-codex-mini': 'gpt-5.1-codex-mini',
            'gpt-5.2': 'gpt-5.2',
            'gpt-5.2-codex': 'gpt-5.2-codex',
            'gpt-5.3': 'gpt-5.3',
            'gpt-5.3-codex': 'gpt-5.3-codex',
            'gpt-5.4': 'gpt-5.4',
            'gpt-5.4-mini': 'gpt-5.4-mini'
          }
        },
        extra: {
          email: email || authInfo.email,
          password: password
        },
        group_ids: groupIds,
        concurrency: concurrency,
        priority: priority,
        rate_multiplier: 1,
        auto_pause_on_expired: autoPauseOnExpired
      }
    ]
  };
}

/**
 * 构建 CPA 格式的 payload
 */
export function buildCPAPayload(tokenData: TokenData): CPAPayload | null {
  const { accessToken, refreshToken, idToken, email, password } = tokenData;

  if (!accessToken) {
    console.warn('CPA 格式需要 access_token');
    return null;
  }

  const authInfo = extractAuthInfo(accessToken);
  const now = new Date();
  const expiredDate = new Date((authInfo.expiresAt || 0) * 1000);

  return {
    type: 'codex',
    name: email || authInfo.accountId || 'openai-account',
    provider: 'openai',
    platform: 'openai',
    email: email || authInfo.email,
    email_verified: authInfo.emailVerified,
    expired: expiredDate.toISOString(),
    id_token: idToken,
    account_id: authInfo.accountId,
    accountId: authInfo.accountId,
    chatgpt_account_id: authInfo.accountId,
    chatgptAccountId: authInfo.accountId,
    chatgpt_user_id: authInfo.userId,
    chatgptUserId: authInfo.userId,
    organization_id: authInfo.organizationId,
    organizationId: authInfo.organizationId,
    access_token: accessToken,
    last_refresh: now.toISOString(),
    refresh_token: refreshToken,
    credentials: {
      access_token: accessToken,
      refresh_token: refreshToken,
      id_token: idToken,
      expires_at: authInfo.expiresAt,
      expires_in: authInfo.expiresAt ? 863999 : 0,
      chatgpt_account_id: authInfo.accountId,
      chatgpt_user_id: authInfo.userId,
      organization_id: authInfo.organizationId
    },
    extra: {
      email: email || authInfo.email,
      account_id: authInfo.accountId,
      chatgpt_account_id: authInfo.accountId,
      chatgpt_user_id: authInfo.userId
    },
    token_info: {
      access_token: accessToken,
      refresh_token: refreshToken,
      id_token: idToken,
      account_id: authInfo.accountId,
      chatgpt_account_id: authInfo.accountId,
      chatgpt_user_id: authInfo.userId,
      expires_at: authInfo.expiresAt
    }
  };
}

/**
 * 保存 token 到本地文件
 */
export async function saveTokenToFile(
  tokenData: TokenData,
  outputDir: string,
  format: 'sub2api' | 'cpa' = 'cpa'
): Promise<string | null> {
  try {
    // 确保输出目录存在
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    let payload: any;
    let filename: string;

    if (format === 'sub2api') {
      payload = buildSub2ApiPayload(tokenData);
      if (!payload) {
        console.error('构建 Sub2Api payload 失败');
        return null;
      }
      filename = `${tokenData.email}.sub2api.json`;
    } else {
      payload = buildCPAPayload(tokenData);
      if (!payload) {
        console.error('构建 CPA payload 失败');
        return null;
      }
      filename = `${tokenData.email}.json`;
    }

    const filepath = path.join(outputDir, filename);
    fs.writeFileSync(filepath, JSON.stringify(payload, null, 2), 'utf8');

    console.log(`Token 已保存: ${filepath}`);
    return filepath;
  } catch (error) {
    console.error('保存 token 失败:', error);
    return null;
  }
}

/**
 * 保存 token 到多种格式
 */
export async function saveTokenToMultipleFormats(
  tokenData: TokenData,
  baseOutputDir: string
): Promise<{ cpa: string | null; sub2api: string | null }> {
  const cpaDir = path.join(baseOutputDir, 'cpa');
  const sub2apiDir = path.join(baseOutputDir, 'sub2api');

  const cpaPath = await saveTokenToFile(tokenData, cpaDir, 'cpa');
  // 只要有 access_token 就保存 Sub2Api 格式
  const sub2apiPath = tokenData.accessToken
    ? await saveTokenToFile(tokenData, sub2apiDir, 'sub2api')
    : null;

  return {
    cpa: cpaPath,
    sub2api: sub2apiPath
  };
}
