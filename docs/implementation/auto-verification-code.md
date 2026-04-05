# 自动化验证码获取流程

## 概述

系统已完全实现自动化从临时邮箱 API 获取验证码并填写到输入框的功能。

## API 配置

### 临时邮箱 API 地址
```
BASE_URL: http://114.215.173.42:888
API_KEY: tm_admin_36f53ee440748349007538fde32d1aeeb3ac028c804d7b90
```

### 环境变量配置

在 `.env` 文件中：

```bash
# 启用临时邮箱
USE_TEMP_MAIL=true
TEMP_MAIL_BASE_URL=http://114.215.173.42:888
TEMP_MAIL_API_KEY=tm_admin_36f53ee440748349007538fde32d1aeeb3ac028c804d7b90

# 邮件轮询配置
EMAIL_POLL_INTERVAL_MS=5000
EMAIL_TIMEOUT_MS=180000
```

## 完整自动化流程

### 1. 创建临时邮箱

```typescript
// 在测试开始时自动创建
if (runtimeConfig.useTempMail) {
  tempMailService = createTempMailService(
    tempMailConfig.baseUrl,
    tempMailConfig.apiKey
  );
  
  const emailLocal = generateEmailLocalPart();
  const mailbox = await tempMailService.createMailbox(emailLocal);
  tempMailbox = mailbox;
  
  console.log(`[TempMail] Created temporary email: ${mailbox.full_address}`);
  
  // 将临时邮箱地址设置为环境变量
  process.env.TARGET_EMAIL = mailbox.full_address;
}
```

**API 调用：**
```bash
POST http://114.215.173.42:888/api/mailboxes
Authorization: Bearer tm_admin_36f53ee440748349007538fde32d1aeeb3ac028c804d7b90
Content-Type: application/json

{
  "local_part": "oc1a2b3c4d"
}
```

**响应：**
```json
{
  "mailbox": {
    "id": "mb_abc123",
    "full_address": "oc1a2b3c4d@example.com",
    "local_part": "oc1a2b3c4d",
    "domain": "example.com",
    "created_at": "2026-04-05T10:00:00Z"
  }
}
```

### 2. 使用临时邮箱注册

```typescript
// 输入邮箱地址（使用临时邮箱）
await humanType(activePage, targetProfile.selectors.email, mailbox.full_address);
```

### 3. 自动获取验证码

当检测到需要验证码时：

```typescript
if (codeInputAppeared) {
  console.log('[Flow] Email verification code input detected');
  
  // 等待并获取验证码邮件
  const result = await tempMailService.waitForEmail(tempMailbox.id, {
    timeout: runtimeConfig.emailTimeoutMs,        // 180秒
    interval: runtimeConfig.emailPollIntervalMs,  // 5秒轮询一次
    emailAddress: tempMailbox.full_address,
    useLatestApi: true,  // 使用 /api/latest 端点
    filter: (email) => {
      // 过滤验证码邮件
      if (targetProfile.emailVerification?.senderFilter) {
        return email.from.includes(targetProfile.emailVerification.senderFilter);
      }
      return true;
    }
  });
  
  console.log(`[TempMail] Received email from: ${result.from}`);
  console.log(`[TempMail] Subject: ${result.subject}`);
  
  // 提取验证码
  const extractedCode = tempMailService.extractVerificationCode(result);
  
  console.log(`[TempMail] Extracted verification code: ${extractedCode}`);
}
```

**API 调用（轮询）：**
```bash
# 方式 1: 使用 /api/latest 端点（推荐，更快）
GET http://114.215.173.42:888/api/latest?address=oc1a2b3c4d@example.com
Authorization: Bearer tm_admin_36f53ee440748349007538fde32d1aeeb3ac028c804d7b90

# 方式 2: 使用 /api/mailboxes/{id}/emails 端点
GET http://114.215.173.42:888/api/mailboxes/mb_abc123/emails
Authorization: Bearer tm_admin_36f53ee440748349007538fde32d1aeeb3ac028c804d7b90
```

**响应示例：**
```json
{
  "ok": true,
  "email": {
    "id": "email_xyz789",
    "from": "no-reply@openai.com",
    "to": "oc1a2b3c4d@example.com",
    "subject": "Your verification code",
    "text": "Your verification code is: 123456",
    "html": "<p>Your verification code is: <strong>123456</strong></p>",
    "received_at": "2026-04-05T10:01:00Z"
  }
}
```

### 4. 提取验证码

使用多层级提取策略（参考 gpt-register）：

```typescript
extractVerificationCode(email: Email): string | null {
  const content = [
    email.subject || '',
    email.text_body || '',
    email.html_body || ''
  ].join('\n');

  // 1. OpenAI 特定格式（背景色 #F3F3F3）
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

  // 4. 独立的 6 位数字（排除 # 和 & 前缀）
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
```

### 5. 自动填写验证码

```typescript
// 输入验证码
await humanDelay(800, 1500);
await humanType(activePage, targetProfile.selectors.emailCodeInput!, code);

// 点击继续按钮
if (targetProfile.selectors.emailCodeSubmit) {
  await humanDelay(500, 1000);
  await humanMouseMove(activePage);
  await activePage.locator(targetProfile.selectors.emailCodeSubmit).click();
}
```

### 6. 清理临时邮箱

```typescript
// 测试结束后自动清理
if (tempMailService && tempMailbox && runtimeConfig.useTempMail) {
  const keepMailbox = process.env.KEEP_TEMP_MAILBOX === "true";
  
  if (keepMailbox) {
    console.log(`[TempMail] Keeping temporary mailbox: ${tempMailbox.full_address}`);
    console.log(`[TempMail] Mailbox ID: ${tempMailbox.id}`);
  } else {
    await tempMailService.deleteMailbox(tempMailbox.id);
    console.log(`[TempMail] Deleted temporary mailbox: ${tempMailbox.full_address}`);
  }
}
```

**API 调用：**
```bash
DELETE http://114.215.173.42:888/api/mailboxes/mb_abc123
Authorization: Bearer tm_admin_36f53ee440748349007538fde32d1aeeb3ac028c804d7b90
```

## 完整流程图

```
开始测试
  ↓
创建临时邮箱 (POST /api/mailboxes)
  ↓
获取邮箱地址: oc1a2b3c4d@example.com
  ↓
输入邮箱地址到注册表单
  ↓
点击继续
  ↓
检测到验证码输入框
  ↓
轮询获取邮件 (GET /api/latest?address=...)
  ├─ 每 5 秒轮询一次
  ├─ 最多等待 180 秒
  └─ 过滤验证码邮件
  ↓
收到验证码邮件
  ↓
提取验证码: 123456
  ├─ 尝试 OpenAI 特定格式
  ├─ 尝试 Subject
  ├─ 尝试 HTML 标签
  └─ 尝试独立数字
  ↓
自动填写验证码到输入框
  ↓
点击继续按钮
  ↓
继续后续流程
  ↓
测试结束，删除临时邮箱 (DELETE /api/mailboxes/{id})
```

## 日志输出示例

```
[TempMail] Created temporary email: oc1a2b3c4d@example.com
[Flow] Email verification code input detected
[TempMail] Waiting for verification email...
[TempMail] Polling... (attempt 1)
[TempMail] Polling... (attempt 2)
[TempMail] Received email from: no-reply@openai.com
[TempMail] Subject: Your verification code
[TempMail] Extracted verification code: 123456
[TempMail] Deleted temporary mailbox: oc1a2b3c4d@example.com
```

## 关键特性

### 1. 完全自动化
- ✓ 自动创建临时邮箱
- ✓ 自动轮询获取邮件
- ✓ 自动提取验证码
- ✓ 自动填写验证码
- ✓ 自动清理邮箱

### 2. 智能轮询
- 每 5 秒轮询一次
- 最多等待 180 秒
- 自动去重（避免重复处理）
- 支持邮件过滤

### 3. 多层级提取
- OpenAI 特定格式优先
- Subject、HTML、纯文本多种来源
- 自动排除干扰数字（如 177010）

### 4. 人类行为模拟
- 随机延迟
- 逐字符输入
- 鼠标移动

### 5. 灵活配置
- 可选择保留邮箱（调试用）
- 可配置轮询间隔
- 可配置超时时间

## 测试命令

```bash
# 运行测试（使用临时邮箱）
npm test

# 保留临时邮箱（用于调试）
KEEP_TEMP_MAILBOX=true npm test
```

## 手动测试 API

```bash
#!/bin/bash
BASE="http://114.215.173.42:888"
KEY="tm_admin_36f53ee440748349007538fde32d1aeeb3ac028c804d7b90"

# 1. 创建邮箱
MB=$(curl -s -X POST $BASE/api/mailboxes \
  -H "Authorization: Bearer $KEY" \
  -H "Content-Type: application/json" \
  -d '{"local_part": "test123"}')
echo $MB | python3 -m json.tool

# 2. 获取邮箱 ID
MB_ID=$(echo $MB | python3 -c "import sys,json; print(json.load(sys.stdin)['mailbox']['id'])")
MB_ADDR=$(echo $MB | python3 -c "import sys,json; print(json.load(sys.stdin)['mailbox']['full_address'])")
echo "邮箱: $MB_ADDR (ID: $MB_ID)"

# 3. 获取最新邮件
curl -s "$BASE/api/latest?address=$MB_ADDR" \
  -H "Authorization: Bearer $KEY" | python3 -m json.tool

# 4. 删除邮箱
curl -s -X DELETE $BASE/api/mailboxes/$MB_ID \
  -H "Authorization: Bearer $KEY"
echo "✓ 邮箱已删除"
```

## 相关文件

- [src/email/temp-mail.ts](../src/email/temp-mail.ts) - 临时邮箱服务实现
- [tests/protection-validation.spec.ts](../tests/protection-validation.spec.ts) - 自动化测试
- [.env.example](../.env.example) - 环境变量配置示例
- [VERIFICATION-CODE-UPDATE.md](VERIFICATION-CODE-UPDATE.md) - 验证码提取详解

## 故障排除

### 问题 1: 无法创建邮箱
- 检查 API 地址和密钥是否正确
- 检查网络连接

### 问题 2: 获取不到验证码邮件
- 增加轮询间隔时间
- 检查邮件过滤器配置
- 查看日志确认邮件是否到达

### 问题 3: 验证码提取失败
- 检查邮件内容格式
- 查看日志中的邮件内容
- 调整验证码正则表达式

## 总结

系统已完全实现自动化验证码获取流程，无需任何手动干预：
1. ✓ 自动创建临时邮箱
2. ✓ 自动获取验证码邮件
3. ✓ 自动提取验证码
4. ✓ 自动填写验证码
5. ✓ 自动清理邮箱

整个过程完全自动化，可靠且高效！
