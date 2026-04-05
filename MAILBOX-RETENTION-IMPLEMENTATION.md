# 临时邮箱保留功能 - 完整实现说明

## 问题回答

**问题：** 邮箱生成后，在 tempmail 邮箱内看不到，是自动化删除了吗？

**答案：** 是的！测试结束后会自动删除邮箱。

## 已实现的解决方案

### ✅ 新增环境变量控制

现在可以通过 `KEEP_TEMP_MAILBOX` 环境变量控制是否保留邮箱。

### 修改的文件

1. **tests/protection-validation.spec.ts** (第 360-374 行)
   - 添加了 `KEEP_TEMP_MAILBOX` 环境变量检查
   - 如果设置为 `true`，邮箱不会被删除
   - 会在日志中输出邮箱地址和 ID

2. **.env.example**
   - 添加了 `KEEP_TEMP_MAILBOX=false` 配置项
   - 添加了详细的注释说明

### 新增的文档

1. **KEEP-MAILBOX-GUIDE.md** - 详细说明文档
2. **QUICK-KEEP-MAILBOX.md** - 快速使用指南

## 使用方法

### 方法 1：保留邮箱（推荐用于调试）

在 `.env` 文件中添加：

```bash
KEEP_TEMP_MAILBOX=true
```

运行测试后，邮箱不会被删除，日志会显示：

```
[TempMail] Created temporary email: abc123xyz@temp-mail.io
[TempMail] Mailbox ID: 12345678-1234-1234-1234-123456789abc
...测试过程...
[TempMail] Keeping temporary mailbox: abc123xyz@temp-mail.io
[TempMail] Mailbox ID: 12345678-1234-1234-1234-123456789abc
```

### 方法 2：自动删除（默认，推荐用于自动化）

在 `.env` 文件中设置：

```bash
KEEP_TEMP_MAILBOX=false
```

或者不设置该变量（默认为 false），测试结束后会自动删除：

```
[TempMail] Deleted temporary mailbox: abc123xyz@temp-mail.io
```

## 查看保留的邮箱

### 通过 API 查看邮件

```bash
# 使用日志中的 mailbox_id
curl -H "Authorization: Bearer tm_admin_36f53ee440748349007538fde32d1aeeb3ac028c804d7b90" \
  http://114.215.173.42:888/api/mailboxes/{mailbox_id}/emails
```

### 通过 tempmail Web 界面

如果 tempmail 服务提供 Web 界面，可以直接登录查看。

## 完整配置示例

```bash
# .env 文件

# 启用临时邮箱
USE_TEMP_MAIL=true
TEMP_MAIL_BASE_URL=http://114.215.173.42:888
TEMP_MAIL_API_KEY=tm_admin_36f53ee440748349007538fde32d1aeeb3ac028c804d7b90

# 保留邮箱（调试时使用）
KEEP_TEMP_MAILBOX=true

# 不需要配置 TARGET_EMAIL（会自动生成）
TARGET_PASSWORD=your_password_here
```

## 代码实现细节

### 修改前的代码

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

### 修改后的代码

```typescript
// 清理临时邮箱（可通过环境变量控制是否保留）
if (tempMailService && tempMailbox && runtimeConfig.useTempMail) {
  const keepMailbox = process.env.KEEP_TEMP_MAILBOX === "true";
  if (keepMailbox) {
    console.log(`[TempMail] Keeping temporary mailbox: ${tempMailbox.full_address}`);
    console.log(`[TempMail] Mailbox ID: ${tempMailbox.id}`);
  } else {
    try {
      await tempMailService.deleteMailbox(tempMailbox.id);
      console.log(`[TempMail] Deleted temporary mailbox: ${tempMailbox.full_address}`);
    } catch (error) {
      console.error(`[TempMail] Failed to delete mailbox:`, error);
    }
  }
}
```

## 使用场景

| 场景 | 配置 | 说明 |
|------|------|------|
| 开发调试 | `KEEP_TEMP_MAILBOX=true` | 保留邮箱，方便查看邮件内容 |
| 自动化测试 | `KEEP_TEMP_MAILBOX=false` | 自动清理，避免资源浪费 |
| CI/CD | `KEEP_TEMP_MAILBOX=false` | 自动清理，保持环境整洁 |
| 手动测试 | `KEEP_TEMP_MAILBOX=true` | 保留邮箱，方便验证结果 |

## 注意事项

1. **资源管理：** 保留的邮箱会占用 tempmail 服务资源，记得定期清理
2. **安全性：** 邮箱 ID 和地址会在日志中输出，注意保护敏感信息
3. **默认行为：** 如果不设置该变量，默认会自动删除邮箱
4. **测试失败：** 即使测试失败，也会执行清理逻辑（在 finally 块中）

## 相关文档

- [QUICK-KEEP-MAILBOX.md](QUICK-KEEP-MAILBOX.md) - 快速使用指南
- [KEEP-MAILBOX-GUIDE.md](KEEP-MAILBOX-GUIDE.md) - 详细功能说明
- [AUTO-GENERATION-GUIDE.md](AUTO-GENERATION-GUIDE.md) - 自动生成功能文档
- [TEMP-MAIL-GUIDE.md](TEMP-MAIL-GUIDE.md) - 临时邮箱功能文档

---

**功能状态：** ✅ 已实现  
**测试状态：** ⚠️ 需要运行测试验证  
**推荐使用：** 开发调试时启用
