# 临时邮箱保留功能说明

## 问题

邮箱生成后，在 tempmail 邮箱后台看不到，因为测试结束后会自动删除。

## 原因

代码中有两处会自动删除邮箱：

### 1. 测试结束时删除
**位置：** `tests/protection-validation.spec.ts` 第 360-367 行

```typescript
// 清理临时邮箱
if (tempMailService && tempMailbox && runtimeConfig.useTempMail) {
  try {
    await tempMailService.deleteMailbox(tempMailbox.id);
    console.log(`[TempMail] Deleted temporary mailbox: ${tempMailbox.full_address}`);
  } catch (error) {
    console.error(`[TempMail] Failed to delete mailbox:`, error);
  }
}
```

### 2. getVerificationCode 方法默认删除
**位置：** `src/email/temp-mail.ts` 第 239-242 行

```typescript
if (!options.keepMailbox) {
  await this.deleteMailbox(mailbox.id);
  console.log(`[TempMail] Deleted mailbox: ${mailbox.full_address}`);
}
```

## 解决方案

### 方案 1：使用环境变量控制（推荐）

**已实现！** 现在可以通过环境变量控制是否保留邮箱。

#### 使用方法

在 `.env` 文件中添加：

```bash
# 保留临时邮箱（不删除）
KEEP_TEMP_MAILBOX=true
```

然后运行测试：

```bash
npm test
```

测试结束后，邮箱不会被删除，你可以在 tempmail 后台查看：
- 邮箱地址会在日志中显示
- 邮箱 ID 也会在日志中显示

#### 日志输出示例

```
[TempMail] Created temporary email: abc123xyz@temp-mail.io
[TempMail] Mailbox ID: 12345678-1234-1234-1234-123456789abc
...测试过程...
[TempMail] Keeping temporary mailbox: abc123xyz@temp-mail.io
[TempMail] Mailbox ID: 12345678-1234-1234-1234-123456789abc
```

### 方案 2：手动调用时保留邮箱

如果你在代码中手动调用 `getVerificationCode`，可以传入 `keepMailbox: true`：

```typescript
const { code, mailbox, email } = await tempMailService.getVerificationCode({
  timeout: 180000,
  keepMailbox: true  // 不删除邮箱
});

console.log(`邮箱地址: ${mailbox.full_address}`);
console.log(`邮箱 ID: ${mailbox.id}`);
```

### 方案 3：完全禁用自动删除（调试用）

如果你想完全禁用自动删除功能，可以注释掉删除代码：

**文件：** `tests/protection-validation.spec.ts`

```typescript
// 清理临时邮箱
if (tempMailService && tempMailbox && runtimeConfig.useTempMail) {
  // 注释掉删除逻辑
  // try {
  //   await tempMailService.deleteMailbox(tempMailbox.id);
  //   console.log(`[TempMail] Deleted temporary mailbox: ${tempMailbox.full_address}`);
  // } catch (error) {
  //   console.error(`[TempMail] Failed to delete mailbox:`, error);
  // }
  
  console.log(`[TempMail] Mailbox preserved: ${tempMailbox.full_address}`);
  console.log(`[TempMail] Mailbox ID: ${tempMailbox.id}`);
}
```

## 查看保留的邮箱

### 方法 1：通过 API 查看

```bash
# 获取邮箱列表
curl -H "Authorization: Bearer tm_admin_36f53ee440748349007538fde32d1aeeb3ac028c804d7b90" \
  http://114.215.173.42:888/api/mailboxes

# 获取特定邮箱的邮件
curl -H "Authorization: Bearer tm_admin_36f53ee440748349007538fde32d1aeeb3ac028c804d7b90" \
  http://114.215.173.42:888/api/mailboxes/{mailbox_id}/emails
```

### 方法 2：通过 tempmail 后台

如果 tempmail 服务有 Web 界面，可以直接登录查看。

## 配置文件更新

已更新 `.env.example` 文件，添加了 `KEEP_TEMP_MAILBOX` 配置项：

```bash
# 是否保留临时邮箱（不删除），用于调试
# true = 保留邮箱，可以在 tempmail 后台查看
# false = 测试结束后自动删除（默认）
KEEP_TEMP_MAILBOX=false
```

## 建议

- **开发/调试时：** 设置 `KEEP_TEMP_MAILBOX=true`，方便查看邮件内容
- **自动化测试时：** 设置 `KEEP_TEMP_MAILBOX=false`，避免邮箱堆积
- **生产环境：** 始终设置 `KEEP_TEMP_MAILBOX=false`，自动清理资源

## 注意事项

1. 保留的邮箱会占用 tempmail 服务的资源
2. 建议定期手动清理不需要的邮箱
3. 邮箱 ID 和地址会在日志中输出，记得保存以便后续查看

---

**功能状态：** ✅ 已实现  
**配置难度：** 简单  
**推荐使用：** 开发调试时启用
