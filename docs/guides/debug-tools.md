# 自动化调试工具使用指南

## 问题现象

页面到达验证码输入界面后卡住，需要自动化调试来排查问题。

## 调试工具

我们提供了三种调试工具：

### 1. 命令行调试工具（推荐）

**用途：** 快速测试临时邮箱 API 和验证码提取

**运行：**
```bash
npm run debug:tempmail
```

**功能：**
- ✓ 自动创建临时邮箱
- ✓ 显示邮箱地址
- ✓ 轮询获取邮件（60秒）
- ✓ 自动提取验证码
- ✓ 自动清理邮箱

**输出示例：**
```
========================================
临时邮箱调试工具
========================================

步骤 1: 创建临时邮箱
✓ 邮箱创建成功
  邮箱地址: test123@hhxxttxx.us.ci
  邮箱 ID: mb_abc123

请向以下地址发送测试邮件:
  test123@hhxxttxx.us.ci

建议邮件内容:
  主题: Test verification code
  内容: Your verification code is: 123456

步骤 2: 轮询获取邮件
  最多尝试: 12 次
  轮询间隔: 5000ms

  尝试 1/12...
  尝试 2/12...
✓ 收到邮件！
  From: no-reply@openai.com
  Subject: Your verification code
  Received: 2026-04-05T10:00:00Z

✓ 验证码: 123456

步骤 3: 清理邮箱
✓ 邮箱删除成功

========================================
调试完成
========================================
```

### 2. Bash 脚本调试工具

**用途：** 验证 API 连接和基本功能

**运行：**
```bash
npm run debug:api
# 或
bash scripts/verify-tempmail-api.sh
```

**功能：**
- ✓ 测试创建邮箱
- ✓ 测试获取最新邮件
- ✓ 测试获取邮件列表
- ✓ 测试删除邮箱

**输出示例：**
```
==========================================
自动化验证码功能验证
==========================================

步骤 1: 创建临时邮箱
✓ 邮箱创建成功
  邮箱地址: test456@hhxxttxx.us.ci
  邮箱 ID: mb_def456

步骤 2: 测试获取邮件 API
  使用 /api/latest 端点...
✓ API 调用成功
  响应: 无邮件

步骤 3: 测试获取邮件列表 API
✓ API 调用成功
  邮件数量: 0

步骤 4: 删除临时邮箱
✓ 邮箱删除成功

==========================================
验证完成！
==========================================

功能状态：
  ✓ 创建临时邮箱
  ✓ 获取最新邮件 (/api/latest)
  ✓ 获取邮件列表 (/api/mailboxes/{id}/emails)
  ✓ 删除临时邮箱

自动化验证码功能已就绪！
```

### 3. Playwright 测试调试工具

**用途：** 完整的集成测试，包括验证码提取逻辑测试

**运行：**
```bash
npm run debug:test
```

**功能：**
- ✓ 测试临时邮箱 API
- ✓ 测试邮件轮询
- ✓ 测试验证码提取（多种格式）
- ✓ 详细的日志输出

## 使用流程

### 场景 1: 快速验证 API 是否正常

```bash
# 1. 运行 API 验证脚本
npm run debug:api

# 如果所有步骤都显示 ✓，说明 API 正常
```

### 场景 2: 测试完整的邮件接收流程

```bash
# 1. 运行命令行调试工具
npm run debug:tempmail

# 2. 工具会显示临时邮箱地址，例如：
#    test123@hhxxttxx.us.ci

# 3. 向该地址发送测试邮件
#    - 可以使用任何邮箱发送
#    - 建议主题: Test verification code
#    - 建议内容: Your verification code is: 123456

# 4. 工具会自动轮询并显示结果
```

### 场景 3: 调试实际注册流程

```bash
# 1. 在 .env 中启用详细日志
USE_TEMP_MAIL=true
KEEP_TEMP_MAILBOX=true

# 2. 运行测试
npm test

# 3. 查看控制台输出，关键日志：
#    [TempMail] Created temporary email: xxx@xxx.com
#    [TempMail] Waiting for verification email...
#    [TempMail] Polling attempt 1...
#    [TempMail] ✓ Received email from: ...
#    [TempMail] ✓ Extracted verification code: ...

# 4. 如果卡住，查看最后一条日志
```

## 常见问题诊断

### 问题 1: API 连接失败

**症状：**
```
✗ 邮箱创建失败: HTTP 500: Internal Server Error
```

**诊断：**
```bash
# 测试 API 连接
curl -s http://114.215.173.42:888/api/mailboxes \
  -H "Authorization: Bearer tm_admin_36f53ee440748349007538fde32d1aeeb3ac028c804d7b90"
```

**解决方案：**
- 检查网络连接
- 检查 API 地址是否正确
- 检查 API 密钥是否有效

### 问题 2: 轮询超时，未收到邮件

**症状：**
```
[TempMail] Polling attempt 1...
[TempMail] No email found yet
[TempMail] Polling attempt 2...
...
[TempMail] ✗ Timeout waiting for email
```

**诊断：**
```bash
# 手动查询邮件
npm run debug:tempmail

# 在另一个终端手动发送邮件到显示的地址
```

**可能原因：**
1. 邮件发送延迟（OpenAI 邮件可能需要 10-30 秒）
2. 邮箱地址错误
3. 邮件被过滤器过滤掉

**解决方案：**
- 增加超时时间：`.env` 中设置 `EMAIL_TIMEOUT_MS=300000`
- 检查邮件过滤器配置
- 临时禁用过滤器测试

### 问题 3: 收到邮件但提取不到验证码

**症状：**
```
[TempMail] ✓ Received email from: no-reply@openai.com
[TempMail] ✗ Failed to extract code from email
```

**诊断：**
```bash
# 运行验证码提取测试
npm run debug:test

# 查看哪些格式可以提取，哪些不能
```

**解决方案：**
1. 查看邮件原始内容（日志中会显示）
2. 调整 `extractVerificationCode` 方法
3. 添加自定义正则表达式

### 问题 4: 验证码填写后没反应

**症状：**
```
[Flow] ✓ Verification code filled
[Flow] ✓ Submit button clicked
# 然后卡住
```

**诊断：**
- 检查选择器是否正确
- 检查是否有 JavaScript 错误
- 截图查看页面状态

**解决方案：**
- 更新选择器
- 增加等待时间
- 检查是否需要额外操作

## 日志分析

### 成功的日志模式

```
[TempMail] Created temporary email: xxx@xxx.com
[Flow] Email verification code input detected
[TempMail] Waiting for verification email...
[TempMail] Starting email polling...
[TempMail] Polling attempt 1 (elapsed: 0ms / 180000ms)
[TempMail] Fetching latest email via /api/latest...
[TempMail] No email found yet
[TempMail] Waiting 5000ms before next attempt...
[TempMail] Polling attempt 2 (elapsed: 5000ms / 180000ms)
[TempMail] ✓ Got latest email: from=no-reply@openai.com
[TempMail] New email found: email_xyz
[TempMail] ✓ Found matching email!
[TempMail] ✓ Received email from: no-reply@openai.com
[TempMail] ✓ Extracted verification code: 123456
[Flow] Filling verification code: 123456
[Flow] ✓ Verification code filled
[Flow] ✓ Submit button clicked
```

### 失败的日志模式

#### 模式 1: API 连接失败
```
[TempMail] Created temporary email: xxx@xxx.com
[Flow] Email verification code input detected
[TempMail] Waiting for verification email...
[TempMail] ✗ Error fetching emails: HTTP 500
```

#### 模式 2: 轮询超时
```
[TempMail] Polling attempt 1...
[TempMail] No email found yet
...
[TempMail] Polling attempt 36...
[TempMail] ✗ Timeout waiting for email after 180000ms
```

#### 模式 3: 验证码提取失败
```
[TempMail] ✓ Received email from: no-reply@openai.com
[TempMail] ✗ Failed to extract code from email
[TempMail] Email subject: Your verification code
[TempMail] Email text: Please verify...
```

## 快速排查清单

运行以下命令进行快速排查：

```bash
# 1. 验证 API 连接
npm run debug:api

# 2. 测试邮件接收（需要手动发送测试邮件）
npm run debug:tempmail

# 3. 测试验证码提取逻辑
npm run debug:test

# 4. 运行完整测试（带详细日志）
npm test
```

## 获取帮助

如果以上方法都无法解决问题，请提供：

1. **完整的控制台日志**
   ```bash
   npm test > debug.log 2>&1
   ```

2. **调试工具输出**
   ```bash
   npm run debug:tempmail > tempmail-debug.log 2>&1
   ```

3. **环境配置**（隐藏敏感信息）
   ```bash
   cat .env | grep -v "API_KEY"
   ```

4. **邮箱信息**（从日志中获取）
   - 邮箱地址
   - 邮箱 ID
   - 是否收到邮件

## 相关文档

- [DEBUG-VERIFICATION-CODE.md](DEBUG-VERIFICATION-CODE.md) - 详细调试指南
- [AUTO-VERIFICATION-CODE.md](AUTO-VERIFICATION-CODE.md) - 自动化验证码功能说明
- [AUTOMATION-SUMMARY.md](AUTOMATION-SUMMARY.md) - 自动化功能总结
