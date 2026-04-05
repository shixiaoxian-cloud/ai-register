# 验证码获取功能更新

## 概述

已将验证码获取功能更新为完全匹配 `gpt-register` 项目的实现。

## 主要更新

### 1. 验证码提取逻辑

参考 gpt-register 的 `extract_verification_code` 函数，实现了多层级的验证码提取策略：

```typescript
extractVerificationCode(email: Email, pattern?: RegExp): string | null {
  // 1. 匹配 OpenAI 特定格式（背景色为 #F3F3F3 的段落）
  // 2. 从 Subject 中提取
  // 3. 匹配 HTML 标签内的 6 位数字
  // 4. 匹配独立的 6 位数字（排除 # 和 & 前缀）
  // 5. 使用自定义正则（如果提供）
}
```

**特点：**
- 自动排除 `177010`（OpenAI 的端口号，避免误识别）
- 支持多种邮件格式（HTML、纯文本、Subject）
- 优先匹配 OpenAI 特定的 HTML 格式

### 2. 新增 getLatestEmail API

参考 gpt-register 的 `_fetch_latest_email` 方法：

```typescript
async getLatestEmail(emailAddress: string): Promise<Email | null> {
  // 使用 /api/latest?address={email} 端点
  // 支持多种响应格式：
  // - { ok: true, email: {...} }
  // - { email: {...} }
  // - 直接返回邮件对象
}
```

**优势：**
- 更快的响应速度（直接获取最新邮件）
- 减少 API 调用次数
- 支持多种 API 响应格式

### 3. 增强的 waitForEmail 方法

```typescript
async waitForEmail(mailboxId: string, options: {
  timeout?: number;
  interval?: number;
  filter?: (email: Email) => boolean;
  emailAddress?: string;
  useLatestApi?: boolean; // 新增：使用 /api/latest 端点
}): Promise<Email>
```

**新功能：**
- 支持使用 `/api/latest` 端点（更快）
- 自动去重（避免重复处理同一封邮件）
- 灵活的邮件过滤器

### 4. 验证码输入框选择器

更新了 `target.profile.ts` 中的选择器以支持您提供的 HTML 结构：

```typescript
emailCodeInput: [
  'input[name="verificationCode"]',
  'input[name="code"]',
  'input[aria-label="Code"]',
  'input[placeholder="Code"]',
  'div._typeableLabelText_18qcl_88:has-text("Code") + input',
  'div._typeableLabelTextPositioner_18qcl_88:has(div._typeableLabelText_18qcl_88:has-text("Code")) input'
].join(", ")
```

## 对比

### gpt-register (Python)

```python
def extract_verification_code(content: str) -> Optional[str]:
    if not content:
        return None
    m = re.search(r"background-color:\s*#F3F3F3[^>]*>[\s\S]*?(\d{6})[\s\S]*?</p>", content)
    if m:
        return m.group(1)
    m = re.search(r"Subject:.*?(\d{6})", content)
    if m and m.group(1) != "177010":
        return m.group(1)
    for pat in [r">\s*(\d{6})\s*<", r"(?<![#&])\b(\d{6})\b"]:
        for code in re.findall(pat, content):
            if code != "177010":
                return code
    return None

def _fetch_latest_email(self, email: str) -> Optional[Dict[str, Any]]:
    res = session.get(
        f"{self.api_base}/api/latest?address={quote(email)}",
        headers=build_mail_api_headers(self.api_key),
        timeout=30,
        verify=False,
    )
    # 处理多种响应格式...
```

### ai-register (TypeScript)

```typescript
extractVerificationCode(email: Email, pattern?: RegExp): string | null {
  const content = [
    email.subject || '',
    email.text_body || '',
    email.html_body || ''
  ].join('\n');

  // 1. OpenAI 特定格式
  const bgColorMatch = content.match(/background-color:\s*#F3F3F3[^>]*>[\s\S]*?(\d{6})[\s\S]*?<\/p>/);
  if (bgColorMatch && bgColorMatch[1] !== '177010') {
    return bgColorMatch[1];
  }

  // 2-4. 其他匹配策略...
}

async getLatestEmail(emailAddress: string): Promise<Email | null> {
  const response = await fetch(
    `${this.config.baseUrl}/api/latest?address=${encodeURIComponent(emailAddress)}`,
    {
      headers: {
        Authorization: `Bearer ${this.config.apiKey}`
      }
    }
  );
  // 处理多种响应格式...
}
```

## 使用示例

### 在测试中使用

```typescript
// 等待验证码邮件
const result = await tempMailService.waitForEmail(tempMailbox.id, {
  timeout: runtimeConfig.emailTimeoutMs,
  interval: runtimeConfig.emailPollIntervalMs,
  emailAddress: tempMailbox.full_address,
  useLatestApi: true, // 使用 /api/latest 端点
  filter: (email) => {
    return email.from.includes('no-reply@openai.com');
  }
});

// 提取验证码
const code = tempMailService.extractVerificationCode(result);
console.log(`Extracted code: ${code}`);

// 输入验证码
await humanType(page, targetProfile.selectors.emailCodeInput, code);
```

## 验证码提取策略

按优先级顺序：

1. **OpenAI 特定格式**：`background-color: #F3F3F3` 段落中的 6 位数字
2. **Subject 行**：邮件主题中的 6 位数字
3. **HTML 标签内**：`>123456<` 格式
4. **独立数字**：不带 `#` 或 `&` 前缀的 6 位数字
5. **自定义正则**：如果提供了自定义模式

**排除规则：**
- 自动排除 `177010`（OpenAI 端口号）

## API 端点

### 标准端点
```
GET /api/mailboxes/{mailboxId}/emails
```
返回邮箱中的所有邮件列表。

### 最新邮件端点（推荐）
```
GET /api/latest?address={emailAddress}
```
直接返回指定邮箱的最新邮件，更快更高效。

## 兼容性

现在两个项目使用相同的验证码获取逻辑，确保：
- 验证码提取策略一致
- API 调用方式一致
- 支持相同的邮件格式
- 可以共享测试用例

## 相关文件

- [src/email/temp-mail.ts](../src/email/temp-mail.ts) - 临时邮箱服务
- [src/target.profile.ts](../src/target.profile.ts) - 目标站点配置
- [tests/protection-validation.spec.ts](../tests/protection-validation.spec.ts) - 测试文件
