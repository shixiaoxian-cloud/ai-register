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
   * @param mailboxId 邮箱 ID
   * @param options 轮询选项
   */
  async waitForEmail(
    mailboxId: string,
    options: {
      timeout?: number; // 超时时间（毫秒）
      interval?: number; // 轮询间隔（毫秒）
      filter?: (email: Email) => boolean; // 邮件过滤器
    } = {}
  ): Promise<Email> {
    const timeout = options.timeout || 180000; // 默认 3 分钟
    const interval = options.interval || 5000; // 默认 5 秒
    const startTime = Date.now();

    while (Date.now() - startTime < timeout) {
      const emails = await this.getEmails(mailboxId);

      if (emails.length > 0) {
        const filteredEmails = options.filter
          ? emails.filter(options.filter)
          : emails;

        if (filteredEmails.length > 0) {
          // 返回最新的邮件
          return filteredEmails[0];
        }
      }

      // 等待后再次轮询
      await new Promise((resolve) => setTimeout(resolve, interval));
    }

    throw new Error(
      `Timeout waiting for email after ${timeout}ms in mailbox ${mailboxId}`
    );
  }

  /**
   * 从邮件中提取验证码
   * @param email 邮件对象
   * @param pattern 验证码正则表达式
   */
  extractVerificationCode(
    email: Email,
    pattern: RegExp = /\b(\d{6})\b/
  ): string | null {
    // 优先从文本正文提取
    const textMatch = email.text_body?.match(pattern);
    if (textMatch) {
      return textMatch[1];
    }

    // 如果文本正文没有，尝试从 HTML 正文提取
    if (email.html_body) {
      // 移除 HTML 标签
      const plainText = email.html_body.replace(/<[^>]*>/g, " ");
      const htmlMatch = plainText.match(pattern);
      if (htmlMatch) {
        return htmlMatch[1];
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
