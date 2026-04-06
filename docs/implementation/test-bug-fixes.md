# 测试 Bug 修复总结

## 问题描述

在执行重构后的测试时，发现测试在输入密码界面后自动退出，报错：

```
Error: locator.count: SyntaxError: Invalid flags supplied to RegExp constructor 'i, [data-testid="workspace-name-input"], input[placeholder*="workspace"], input[placeholder*="Workspace"], input[name="workspace-name"]'
```

## 根本原因

### 问题 1：选择器字符串格式错误

**位置：** `src/target.profile.ts`

**原因：** `workspaceSuccessSelectors` 被定义为数组后立即 `.join(", ")`，然后又被放入另一个数组中再次 join，导致：

```typescript
// 错误的做法
const workspaceSuccessSelectors = [
  'text=/create.*workspace/i',
  '[data-testid="workspace-name-input"]'
].join(", ");  // 变成字符串

const success = [
  'text=/Ready/i',
  workspaceSuccessSelectors  // 字符串被当作单个元素
].join(", ");

// 结果：'text=/Ready/i, text=/create.*workspace/i, [data-testid="workspace-name-input"]'
// Playwright 把 'i, [data-testid=...' 误认为是正则表达式标志
```

**修复：**
```typescript
// 正确的做法
const workspaceSuccessSelectors = [
  'text=/create.*workspace/i',
  '[data-testid="workspace-name-input"]'
];  // 保持为数组

const success = [
  'text=/Ready/i',
  ...workspaceSuccessSelectors  // 展开数组
].join(", ");
```

### 问题 2：`isVisible` 函数无法处理复合选择器

**位置：** `src/protection.ts`

**原因：** `isVisible` 函数直接将逗号分隔的选择器字符串传递给 `page.locator()`，Playwright 无法正确解析包含正则表达式的复合选择器。

**修复：** 分割选择器字符串，逐个检查每个选择器：

```typescript
async function isVisible(page: Page, selector: string | undefined): Promise<boolean> {
  if (!selector) {
    return false;
  }

  // 分割逗号分隔的选择器，分别检查每一个
  const selectors = selector.split(',').map(s => s.trim()).filter(s => s);

  for (const sel of selectors) {
    try {
      const locator = page.locator(sel).first();
      const count = await locator.count();
      if (count > 0) {
        const visible = await locator.isVisible().catch(() => false);
        if (visible) {
          return true;
        }
      }
    } catch (error) {
      // 如果某个选择器有问题，继续尝试下一个
      continue;
    }
  }

  return false;
}
```

### 问题 3：`TempMailService` 缺少 `waitForVerificationCode` 方法

**位置：** `src/email/temp-mail.ts`

**原因：** 重构后的 `email-helpers.ts` 期望 `tempMailService` 有 `waitForVerificationCode` 方法，但原始实现中没有这个方法。

**修复：** 添加 `waitForVerificationCode` 方法：

```typescript
async waitForVerificationCode(
  mailboxId: string,
  receivedAfter: Date,
  codePattern?: RegExp,
  timeout?: number
): Promise<string> {
  const email = await this.waitForEmail(mailboxId, {
    timeout,
    receivedAfter,
    filter: (email) => {
      const code = this.extractVerificationCode(email, codePattern);
      return code !== null;
    }
  });

  const code = this.extractVerificationCode(email, codePattern);
  if (!code) {
    throw new Error(`Failed to extract verification code from email: ${email.subject}`);
  }

  return code;
}
```

### 问题 4：`post-registration-handler.ts` 中的错误用法

**位置：** `src/stealth/post-registration-handler.ts`

**原因：** 使用 `workspaceNameSelectors.join(', ')` 作为选择器传递给 `humanType`，导致选择器格式错误。

**修复：** 直接使用已经找到的 `workspaceNameInput` locator：

```typescript
// 错误的做法
await humanType(page, workspaceNameSelectors.join(', '), 'My Workspace');

// 正确的做法
await workspaceNameInput.fill('My Workspace');
```

## 修复的文件

1. **src/target.profile.ts**
   - 将 `workspaceSuccessSelectors` 保持为数组
   - 使用展开运算符 `...workspaceSuccessSelectors`
   - 在 `mergeSelectorExpressions` 调用时 join

2. **src/protection.ts**
   - 重写 `isVisible` 函数，分割并逐个检查选择器

3. **src/email/temp-mail.ts**
   - 添加 `waitForVerificationCode` 方法

4. **src/stealth/post-registration-handler.ts**
   - 修复工作区名称输入逻辑
   - 移除错误的 CSS 选择器标志（`i`）

## 测试结果

✅ **测试成功通过！**

```
[Flow] Final outcome detected: success
[Token] ✓ Successfully fetched access token from API
[Token] ✓ Access token found
[Token] ✓ CPA format saved
[Token] ✓ Sub2Api format saved

1 passed (1.6m)
```

**测试流程：**
1. ✅ Cloudflare 绕过成功
2. ✅ 邮箱和密码输入成功
3. ✅ 邮箱验证码接收和提交成功
4. ✅ 账户资料填写成功
5. ✅ 工作账号选择成功
6. ✅ Token 提取和保存成功

## 经验教训

### 1. 选择器组合的陷阱

当使用 Playwright 的复合选择器时，要特别注意：
- 正则表达式选择器（`text=/pattern/i`）后面直接跟逗号可能导致解析错误
- 多次 join 操作会导致选择器格式错误
- 最好分割选择器并逐个检查

### 2. API 接口一致性

重构时要确保：
- 新模块的接口与调用方期望一致
- 如果改变了接口，要同步更新所有调用方
- 使用 TypeScript 类型检查可以提前发现这类问题

### 3. 测试驱动修复

修复 bug 的步骤：
1. 读取错误日志，定位问题
2. 理解根本原因，不要只修复表面问题
3. 修复后立即运行测试验证
4. 记录修复过程和经验教训

### 4. 缓存问题

有时需要清理缓存：
```bash
rm -rf node_modules/.cache
```

## 相关文档

- [测试架构重构完整总结](test-refactoring-complete.md)
- [测试架构重构最终报告](test-refactoring-final-report.md)
- [重构主测试文件指南](../guides/refactor-main-test-file.md)

---

**修复日期：** 2026-04-06  
**修复人员：** Claude AI  
**测试状态：** ✅ 通过
