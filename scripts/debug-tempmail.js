#!/usr/bin/env node

/**
 * 临时邮箱调试工具
 * 用于快速测试临时邮箱 API 和验证码获取
 */

const fetch = require('node-fetch');

const BASE_URL = 'http://114.215.173.42:888';
const API_KEY = 'tm_admin_36f53ee440748349007538fde32d1aeeb3ac028c804d7b90';

// 颜色输出
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

async function createMailbox() {
  log('\n步骤 1: 创建临时邮箱', 'blue');

  try {
    const response = await fetch(`${BASE_URL}/api/mailboxes`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({})
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    const mailbox = data.mailbox;

    log('✓ 邮箱创建成功', 'green');
    log(`  邮箱地址: ${mailbox.full_address}`);
    log(`  邮箱 ID: ${mailbox.id}`);

    return mailbox;
  } catch (error) {
    log(`✗ 创建邮箱失败: ${error.message}`, 'red');
    throw error;
  }
}

async function getLatestEmail(emailAddress) {
  try {
    const response = await fetch(
      `${BASE_URL}/api/latest?address=${encodeURIComponent(emailAddress)}`,
      {
        headers: {
          'Authorization': `Bearer ${API_KEY}`
        }
      }
    );

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    return data.email || null;
  } catch (error) {
    log(`✗ 获取邮件失败: ${error.message}`, 'red');
    return null;
  }
}

async function getEmails(mailboxId) {
  try {
    const response = await fetch(
      `${BASE_URL}/api/mailboxes/${mailboxId}/emails`,
      {
        headers: {
          'Authorization': `Bearer ${API_KEY}`
        }
      }
    );

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    return data.data || [];
  } catch (error) {
    log(`✗ 获取邮件列表失败: ${error.message}`, 'red');
    return [];
  }
}

async function deleteMailbox(mailboxId) {
  try {
    const response = await fetch(
      `${BASE_URL}/api/mailboxes/${mailboxId}`,
      {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${API_KEY}`
        }
      }
    );

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    log('✓ 邮箱删除成功', 'green');
  } catch (error) {
    log(`✗ 删除邮箱失败: ${error.message}`, 'red');
  }
}

function extractVerificationCode(email) {
  const content = [
    email.subject || '',
    email.text || email.text_body || '',
    email.html || email.html_body || ''
  ].join('\n');

  // 1. OpenAI 特定格式
  const bgColorMatch = content.match(/background-color:\s*#F3F3F3[^>]*>[\s\S]*?(\d{6})[\s\S]*?<\/p>/);
  if (bgColorMatch && bgColorMatch[1] !== '177010') {
    return bgColorMatch[1];
  }

  // 2. Subject 中的 6 位数字
  const subjectMatch = email.subject?.match(/(\d{6})/);
  if (subjectMatch && subjectMatch[1] !== '177010') {
    return subjectMatch[1];
  }

  // 3. HTML 标签内的 6 位数字
  const tagMatch = content.match(/>\s*(\d{6})\s*</);
  if (tagMatch && tagMatch[1] !== '177010') {
    return tagMatch[1];
  }

  // 4. 独立的 6 位数字
  const matches = content.match(/(?<![#&])\b(\d{6})\b/g);
  if (matches) {
    for (const code of matches) {
      if (code !== '177010') {
        return code;
      }
    }
  }

  return null;
}

async function pollForEmail(mailboxId, emailAddress, maxAttempts = 12, interval = 5000) {
  log('\n步骤 2: 轮询获取邮件', 'blue');
  log(`  最多尝试: ${maxAttempts} 次`);
  log(`  轮询间隔: ${interval}ms`);
  log('');

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    log(`  尝试 ${attempt}/${maxAttempts}...`, 'yellow');

    // 使用 /api/latest 端点
    const email = await getLatestEmail(emailAddress);

    if (email) {
      log('✓ 收到邮件！', 'green');
      log(`  From: ${email.from}`);
      log(`  Subject: ${email.subject}`);
      log(`  Received: ${email.received_at || email.createdAt}`);

      // 提取验证码
      const code = extractVerificationCode(email);
      if (code) {
        log(`\n✓ 验证码: ${code}`, 'green');
      } else {
        log(`\n✗ 未能提取验证码`, 'red');
        log(`  邮件内容预览:`);
        const text = email.text || email.text_body || '';
        log(`  ${text.substring(0, 200)}...`);
      }

      return email;
    }

    if (attempt < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, interval));
    }
  }

  log('✗ 超时：未收到邮件', 'red');
  return null;
}

async function main() {
  log('========================================', 'blue');
  log('临时邮箱调试工具', 'blue');
  log('========================================', 'blue');

  let mailbox;

  try {
    // 创建邮箱
    mailbox = await createMailbox();

    log('\n请向以下地址发送测试邮件:', 'yellow');
    log(`  ${mailbox.full_address}`, 'yellow');
    log('\n建议邮件内容:', 'yellow');
    log('  主题: Test verification code');
    log('  内容: Your verification code is: 123456');
    log('');

    // 轮询邮件（60秒，每5秒一次）
    const email = await pollForEmail(mailbox.id, mailbox.full_address, 12, 5000);

    if (!email) {
      log('\n提示: 如果未收到邮件，请检查:', 'yellow');
      log('  1. 邮件是否已发送');
      log('  2. 邮箱地址是否正确');
      log('  3. 网络连接是否正常');
    }

  } catch (error) {
    log(`\n发生错误: ${error.message}`, 'red');
  } finally {
    // 清理
    if (mailbox) {
      log('\n步骤 3: 清理邮箱', 'blue');
      await deleteMailbox(mailbox.id);
    }
  }

  log('\n========================================', 'blue');
  log('调试完成', 'blue');
  log('========================================', 'blue');
}

// 运行
main().catch(error => {
  log(`\n致命错误: ${error.message}`, 'red');
  process.exit(1);
});
