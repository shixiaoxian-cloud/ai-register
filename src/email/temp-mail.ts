import fetch from "node-fetch";
import { generateEmailLocalPart } from "../utils/email-generator";

/**
 * 临时邮箱 API 配置
 */
export interface TempMailConfig {
  baseUrl: string;
  apiKey: string;
}

/**
 * 邮箱信息
 */
export interface Mailbox {
  id: string;
  full_address: string;
  local_part: string;
  domain: string;
  created_at: string;
}

/**
 * 邮件信息
 */
export interface Email {
  id: string;
  from: string;
  to: string;
  subject: string;
  text_body: string;
  html_body: string;
  received_at: string;
}

/**
 * 临时邮箱服务类
 */
export class TempMailService {
  private config: TempMailConfig;
  private latestApiAvailable: boolean = true; // Track if /api/latest works

  constructor(config: TempMailConfig) {
    this.config = config;
  }

  /**
   * 创建临时邮箱
   * @param localPart 可选的邮箱本地部分，如果不提供则自动生成
   */
  async createMailbox(localPart?: string): Promise<Mailbox> {
    // 如果没有提供本地部分，自动生成一个
    const emailLocal = localPart || generateEmailLocalPart();

    const response = await fetch(`${this.config.baseUrl}/api/mailboxes`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.config.apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ local_part: emailLocal })
    });

    if (!response.ok) {
      throw new Error(`Failed to create mailbox: ${response.statusText}`);
    }

    const data = await response.json();
    return data.mailbox as Mailbox;
  }

  /**
   * 获取邮箱中的所有邮件
   */
  async getEmails(mailboxId: string): Promise<Email[]> {
    const response = await fetch(
      `${this.config.baseUrl}/api/mailboxes/${mailboxId}/emails`,
      {
        headers: {
          Authorization: `Bearer ${this.config.apiKey}`
        }
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to get emails: ${response.statusText}`);
    }

    const data = await response.json();
    return (data.data || []) as Email[];
  }

  /**
   * 获取最新邮件（使用 /api/latest 端点）
   * 参考 gpt-register 的 _fetch_latest_email 实现
   */
  async getLatestEmail(emailAddress: string): Promise<Email | null> {
    try {
      const response = await fetch(
        `${this.config.baseUrl}/api/latest?address=${encodeURIComponent(emailAddress)}`,
        {
          headers: {
            Authorization: `Bearer ${this.config.apiKey}`
          }
        }
      );

      if (!response.ok) {
        if (response.status === 404) {
          console.warn(
            `[TempMail] /api/latest returned 404 - endpoint may not exist or no email found yet`
          );
        } else {
          console.warn(
            `[TempMail] Failed to get latest email: status=${response.status} email=${emailAddress}`
          );
        }
        return null;
      }

      const data: any = await response.json();

      if (!data || typeof data !== 'object') {
        return null;
      }

      // 尝试从不同的响应格式中提取邮件对象
      let mailObj: any = null;

      // 格式 1: { ok: true, email: {...} }
      if (data.ok && data.email && typeof data.email === 'object') {
        mailObj = data.email;
      }
      // 格式 2: { email: {...} }
      else if (data.email && typeof data.email === 'object') {
        mailObj = data.email;
      }
      // 格式 3: 直接返回邮件对象 { subject, body, text, html, ... }
      else if (data.subject || data.body || data.text || data.html) {
        mailObj = data;
      }

      if (!mailObj) {
        return null;
      }

      // 转换为标准的 Email 格式
      return {
        id: mailObj.id || mailObj.message_id || '',
        from: mailObj.from || mailObj.sender || '',
        to: mailObj.to || mailObj.recipient || emailAddress,
        subject: mailObj.subject || '',
        text_body: mailObj.text || mailObj.text_body || mailObj.body || '',
        html_body: mailObj.html || mailObj.html_body || '',
        received_at: mailObj.received_at || mailObj.created_at || new Date().toISOString()
      };
    } catch (error) {
      console.warn(`[TempMail] Error fetching latest email:`, error);
      return null;
    }
  }

  /**
   * 获取单封邮件详情
   */
  async getEmail(mailboxId: string, emailId: string): Promise<Email> {
    const response = await fetch(
      `${this.config.baseUrl}/api/mailboxes/${mailboxId}/emails/${emailId}`,
      {
        headers: {
          Authorization: `Bearer ${this.config.apiKey}`
        }
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to get email: ${response.statusText}`);
    }

    const data = await response.json();
    return data as Email;
  }

  /**
   * 删除邮箱
   */
  async deleteMailbox(mailboxId: string): Promise<void> {
    const response = await fetch(
      `${this.config.baseUrl}/api/mailboxes/${mailboxId}`,
      {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${this.config.apiKey}`
        }
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to delete mailbox: ${response.statusText}`);
    }
  }

  /**
   * 等待接收邮件（轮询）
   * 参考 gpt-register 的 wait_for_verification_code 实现
   * @param mailboxId 邮箱 ID
   * @param options 轮询选项
   */
  async waitForEmail(
    mailboxId: string,
    options: {
      timeout?: number; // 超时时间（毫秒）
      interval?: number; // 轮询间隔（毫秒）
      filter?: (email: Email) => boolean; // 邮件过滤器
      emailAddress?: string; // 邮箱地址（用于 getLatestEmail API）
      useLatestApi?: boolean; // 是否使用 /api/latest 端点
    } = {}
  ): Promise<Email> {
    const timeout = options.timeout || 180000; // 默认 3 分钟
    const interval = options.interval || 5000; // 默认 5 秒
    const startTime = Date.now();
    const seenIds = new Set<string>();
    let attemptCount = 0;
    let consecutive404Count = 0; // Track consecutive 404 failures

    console.log(`[TempMail] Starting email polling...`);
    console.log(`[TempMail] - Timeout: ${timeout}ms (${timeout / 1000}s)`);
    console.log(`[TempMail] - Interval: ${interval}ms`);
    console.log(`[TempMail] - Use Latest API: ${options.useLatestApi}`);
    console.log(`[TempMail] - Email Address: ${options.emailAddress}`);

    while (Date.now() - startTime < timeout) {
      attemptCount++;
      const elapsed = Date.now() - startTime;
      console.log(`[TempMail] Polling attempt ${attemptCount} (elapsed: ${elapsed}ms / ${timeout}ms)`);

      let emails: Email[] = [];

      try {
        // If /api/latest is available and enabled, try it first
        if (this.latestApiAvailable && options.useLatestApi && options.emailAddress) {
          console.log(`[TempMail] Fetching latest email via /api/latest...`);
          const latestEmail = await this.getLatestEmail(options.emailAddress);
          if (latestEmail) {
            console.log(`[TempMail] ✓ Got latest email: from=${latestEmail.from}, subject=${latestEmail.subject}`);
            emails = [latestEmail];
            consecutive404Count = 0; // Reset counter on success
          } else {
            console.log(`[TempMail] No email found yet`);
            consecutive404Count++;

            // After 2 consecutive 404s, fall back to mailbox API
            if (consecutive404Count >= 2) {
              console.warn(`[TempMail] /api/latest endpoint unavailable after ${consecutive404Count} attempts, falling back to mailbox API`);
              console.warn(`[TempMail] Switching to /api/mailboxes/${mailboxId}/emails for remaining attempts`);
              this.latestApiAvailable = false;

              // Immediately try the mailbox API instead of waiting
              console.log(`[TempMail] Fetching emails via /api/mailboxes/${mailboxId}/emails...`);
              emails = await this.getEmails(mailboxId);
              console.log(`[TempMail] ✓ Got ${emails.length} email(s)`);
            }
          }
        } else {
          // Use standard getEmails endpoint
          console.log(`[TempMail] Fetching emails via /api/mailboxes/${mailboxId}/emails...`);
          emails = await this.getEmails(mailboxId);
          console.log(`[TempMail] ✓ Got ${emails.length} email(s)`);
        }
      } catch (error) {
        console.error(`[TempMail] ✗ Error fetching emails:`, error);
      }

      if (emails.length > 0) {
        console.log(`[TempMail] Processing ${emails.length} email(s)...`);

        // 过滤已见过的邮件
        const newEmails = emails.filter(email => {
          const emailId = email.id || email.subject + email.received_at;
          if (seenIds.has(emailId)) {
            console.log(`[TempMail] Skipping seen email: ${emailId}`);
            return false;
          }
          seenIds.add(emailId);
          console.log(`[TempMail] New email found: ${emailId}`);
          return true;
        });

        if (newEmails.length > 0) {
          console.log(`[TempMail] Found ${newEmails.length} new email(s)`);

          const filteredEmails = options.filter
            ? newEmails.filter(email => {
                console.log(`[TempMail] Applying filter to email from: ${email.from}`);
                const result = options.filter!(email);
                console.log(`[TempMail] Filter result: ${result}`);
                return result;
              })
            : newEmails;

          if (filteredEmails.length > 0) {
            console.log(`[TempMail] ✓ Found matching email!`);
            // 返回最新的邮件
            return filteredEmails[0];
          } else {
            console.log(`[TempMail] No emails passed the filter`);
          }
        } else {
          console.log(`[TempMail] No new emails (all seen before)`);
        }
      }

      // 等待后再次轮询
      const remainingTime = timeout - (Date.now() - startTime);
      if (remainingTime > 0) {
        console.log(`[TempMail] Waiting ${interval}ms before next attempt... (${remainingTime}ms remaining)`);
        await new Promise((resolve) => setTimeout(resolve, interval));
      }
    }

    console.error(`[TempMail] ✗ Timeout waiting for email after ${timeout}ms (${attemptCount} attempts)`);
    throw new Error(
      `Timeout waiting for email after ${timeout}ms in mailbox ${mailboxId}`
    );
  }

  /**
   * 从邮件中提取验证码
   * 参考 gpt-register 项目的 extract_verification_code 实现
   * @param email 邮件对象
   * @param pattern 验证码正则表达式（可选）
   */
  extractVerificationCode(
    email: Email,
    pattern?: RegExp
  ): string | null {
    // 合并所有邮件内容
    const content = [
      email.subject || '',
      email.text_body || '',
      email.html_body || ''
    ].join('\n');

    if (!content) {
      return null;
    }

    // 1. 尝试匹配 OpenAI 特定格式（背景色为 #F3F3F3 的段落）
    const bgColorMatch = content.match(/background-color:\s*#F3F3F3[^>]*>[\s\S]*?(\d{6})[\s\S]*?<\/p>/);
    if (bgColorMatch && bgColorMatch[1] !== '177010') {
      return bgColorMatch[1];
    }

    // 2. 尝试从 Subject 中提取
    const subjectMatch = email.subject?.match(/(\d{6})/);
    if (subjectMatch && subjectMatch[1] !== '177010') {
      return subjectMatch[1];
    }

    // 3. 尝试匹配 HTML 标签内的 6 位数字
    const tagMatch = content.match(/>\s*(\d{6})\s*</);
    if (tagMatch && tagMatch[1] !== '177010') {
      return tagMatch[1];
    }

    // 4. 尝试匹配独立的 6 位数字（排除 # 和 & 前缀）
    const matches = content.match(/(?<![#&])\b(\d{6})\b/g);
    if (matches) {
      for (const code of matches) {
        if (code !== '177010') {
          return code;
        }
      }
    }

    // 5. 如果提供了自定义正则，使用它
    if (pattern) {
      const customMatch = content.match(pattern);
      if (customMatch && customMatch[1]) {
        return customMatch[1];
      }
    }

    return null;
  }

  /**
   * 完整流程：创建邮箱 -> 等待邮件 -> 提取验证码 -> 删除邮箱
   */
  async getVerificationCode(options: {
    timeout?: number;
    interval?: number;
    codePattern?: RegExp;
    emailFilter?: (email: Email) => boolean;
    keepMailbox?: boolean; // 是否保留邮箱（不删除）
  } = {}): Promise<{ code: string; mailbox: Mailbox; email: Email }> {
    const mailbox = await this.createMailbox();
    console.log(`[TempMail] Created mailbox: ${mailbox.full_address}`);

    try {
      console.log(`[TempMail] Waiting for email...`);
      const email = await this.waitForEmail(mailbox.id, {
        timeout: options.timeout,
        interval: options.interval,
        filter: options.emailFilter
      });

      console.log(`[TempMail] Received email from: ${email.from}`);
      console.log(`[TempMail] Subject: ${email.subject}`);

      const code = this.extractVerificationCode(
        email,
        options.codePattern
      );

      if (!code) {
        throw new Error(
          `Failed to extract verification code from email: ${email.subject}`
        );
      }

      console.log(`[TempMail] Extracted code: ${code}`);

      return { code, mailbox, email };
    } finally {
      if (!options.keepMailbox) {
        await this.deleteMailbox(mailbox.id);
        console.log(`[TempMail] Deleted mailbox: ${mailbox.full_address}`);
      }
    }
  }
}

/**
 * 创建临时邮箱服务实例
 */
export function createTempMailService(
  baseUrl?: string,
  apiKey?: string
): TempMailService {
  const config: TempMailConfig = {
    baseUrl:
      baseUrl ||
      process.env.TEMP_MAIL_BASE_URL ||
      "http://114.215.173.42:888",
    apiKey:
      apiKey ||
      process.env.TEMP_MAIL_API_KEY ||
      "tm_admin_36f53ee440748349007538fde32d1aeeb3ac028c804d7b90"
  };

  return new TempMailService(config);
}
