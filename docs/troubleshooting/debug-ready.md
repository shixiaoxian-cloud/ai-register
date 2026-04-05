# 调试工具已就绪

## 🎯 问题分析

您遇到的问题：**页面到达验证码输入界面后卡住**

可能的原因：
1. 未收到验证码邮件
2. 收到邮件但提取失败
3. 验证码填写失败
4. 后续流程未执行

## 🛠️ 已创建的调试工具

### 1. 命令行调试工具 ⭐ 推荐

**文件：** `scripts/debug-tempmail.js`

**运行：**
```bash
npm run debug:tempmail
```

**功能：**
- 创建临时邮箱
- 显示邮箱地址
- 轮询获取邮件（60秒）
- 自动提取验证码
- 详细的彩色日志输出

**使用场景：** 快速测试邮件接收和验证码提取

---

### 2. Bash API 验证脚本

**文件：** `scripts/verify-tempmail-api.sh`

**运行：**
```bash
npm run debug:api
```

**功能：**
- 测试 API 连接
- 测试所有 API 端点
- 验证基本功能

**使用场景：** 验证 API 是否正常工作

---

### 3. Playwright 测试套件

**文件：** `tests/debug-tempmail.spec.ts`

**运行：**
```bash
npm run debug:test
```

**功能：**
- 完整的集成测试
- 测试验证码提取逻辑（5种格式）
- 详细的测试报告

**使用场景：** 深度测试和验证

---

### 4. 增强的日志系统

**修改的文件：**
- `tests/protection-validation.spec.ts` - 添加详细日志
- `src/email/temp-mail.ts` - 添加轮询日志

**新增日志：**
```
[TempMail] Starting email polling...
[TempMail] Polling attempt 1 (elapsed: 0ms / 180000ms)
[TempMail] Fetching latest email via /api/latest...
[TempMail] ✓ Got latest email: from=..., subject=...
[TempMail] ✓ Extracted verification code: 123456
[Flow] Filling verification code: 123456
[Flow] ✓ Verification code filled
[Flow] ✓ Submit button clicked
```

## 📋 使用步骤

### 快速诊断（3步）

```bash
# 步骤 1: 验证 API 连接
npm run debug:api

# 步骤 2: 测试邮件接收
npm run debug:tempmail
# 然后向显示的邮箱地址发送测试邮件

# 步骤 3: 运行完整测试
npm test
# 查看详细日志输出
```

### 深度调试

如果快速诊断发现问题，使用以下方法：

#### 问题：API 连接失败
```bash
# 手动测试 API
curl -s http://114.215.173.42:888/api/mailboxes \
  -H "Authorization: Bearer tm_admin_36f53ee440748349007538fde32d1aeeb3ac028c804d7b90" \
  -H "Content-Type: application/json" \
  -d '{}'
```

#### 问题：未收到邮件
```bash
# 增加超时时间
# 编辑 .env 文件
EMAIL_TIMEOUT_MS=300000  # 5分钟

# 减少轮询间隔
EMAIL_POLL_INTERVAL_MS=3000  # 3秒
```

#### 问题：验证码提取失败
```bash
# 运行验证码提取测试
npm run debug:test

# 查看哪些格式可以提取
```

## 📊 日志分析

### 正常流程的日志

```
[TempMail] Created temporary email: test@example.com
[Flow] Email verification code input detected
[TempMail] Waiting for verification email...
[TempMail] Mailbox ID: mb_123
[TempMail] Starting email polling...
[TempMail] Polling attempt 1...
[TempMail] No email found yet
[TempMail] Polling attempt 2...
[TempMail] ✓ Got latest email: from=no-reply@openai.com
[TempMail] ✓ Extracted verification code: 123456
[Flow] Filling verification code: 123456
[Flow] ✓ Verification code filled
[Flow] ✓ Submit button clicked
[Flow] Waiting after verification code submission...
```

### 异常流程的日志

#### 卡在轮询
```
[TempMail] Polling attempt 1...
[TempMail] No email found yet
[TempMail] Polling attempt 2...
[TempMail] No email found yet
...
[TempMail] ✗ Timeout waiting for email
```

**原因：** 邮件未到达或 API 问题

#### 卡在提取
```
[TempMail] ✓ Received email from: no-reply@openai.com
[TempMail] ✗ Failed to extract code from email
```

**原因：** 邮件格式不匹配

## 🔍 下一步行动

### 立即执行

1. **运行 API 验证**
   ```bash
   npm run debug:api
   ```
   确认 API 是否正常

2. **运行邮件测试**
   ```bash
   npm run debug:tempmail
   ```
   测试邮件接收流程

3. **运行完整测试**
   ```bash
   npm test
   ```
   查看详细日志，找出卡住的位置

### 根据日志判断

- **如果看到 `[TempMail] Polling attempt X...` 一直重复**
  → 邮件未到达，检查邮件发送

- **如果看到 `✗ Failed to extract code`**
  → 验证码提取失败，查看邮件内容

- **如果看到 `✓ Verification code filled` 后卡住**
  → 选择器或页面加载问题

## 📚 文档索引

1. [DEBUG-TOOLS-GUIDE.md](DEBUG-TOOLS-GUIDE.md) - 调试工具使用指南
2. [DEBUG-VERIFICATION-CODE.md](DEBUG-VERIFICATION-CODE.md) - 验证码调试详解
3. [AUTO-VERIFICATION-CODE.md](AUTO-VERIFICATION-CODE.md) - 自动化验证码功能
4. [AUTOMATION-SUMMARY.md](AUTOMATION-SUMMARY.md) - 自动化功能总结

## ✅ 调试清单

- [ ] 运行 `npm run debug:api` 验证 API
- [ ] 运行 `npm run debug:tempmail` 测试邮件
- [ ] 运行 `npm test` 查看完整日志
- [ ] 检查日志中的错误信息
- [ ] 根据错误类型采取对应措施

## 💡 提示

所有调试工具都已添加详细的日志输出，包括：
- ✓ 每次 API 调用
- ✓ 每次轮询尝试
- ✓ 邮件内容预览
- ✓ 验证码提取过程
- ✓ 表单填写状态

**现在就运行调试工具，找出问题所在！**

```bash
npm run debug:tempmail
```
