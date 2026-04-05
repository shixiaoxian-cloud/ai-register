# Token 提取失败问题排查与解决

## 问题描述

在最后一次测试中，虽然注册流程成功完成，但没有保存 token 文件。

## 问题分析

### 根本原因

测试流程在 **工作区创建页面**（`https://chatgpt.com/create-free-workspace`）停止，导致：

1. **成功标记不匹配**：`targetProfile.selectors.success` 没有包含工作区创建页面的特征
2. **最终状态为 unknown**：因为页面不在预期的成功标记列表中
3. **无法提取 session token**：工作区创建页面上没有 `__Secure-next-auth.session-token` cookie
4. **Token 提取失败**：没有 session token 就无法调用 `/api/auth/session` API 获取 access token

### 测试日志证据

```
[Flow] Final outcome detected: unknown
[STAGE] 人工完成挑战后 | unknown | https://chatgpt.com/create-free-workspace?account_id=...
[Token] Registration completed, attempting to extract tokens...
[Token] Found 44 cookies
[Token] Session token found: false  ← 关键问题
[Token] CSRF token found: true
[Token] ⚠ No access token found in page storage
```

### 对比成功的测试

之前成功的测试（`task-run-mnmbfv73-75fcci`）：
- 成功提取到了 access token
- 保存了完整的 CPA 和 Sub2Api 格式文件
- 文件路径：
  - `output_tokens/task-run-mnmbfv73-75fcci/cpa/run-1__bwvghrz36s@hhxxttxx.us.ci.json`
  - `output_tokens/task-run-mnmbfv73-75fcci/sub2api/run-1__bwvghrz36s@hhxxttxx.us.ci.sub2api.json`

## 解决方案

### 1. 更新成功标记选择器

在 `src/target.profile.ts` 中添加工作区创建页面的标记：

```typescript
success: [
  'text=/Ready when you are/i',
  'text=/What brings you to ChatGPT/i',
  'text=/New chat/i',
  'text=/welcome|dashboard|account created|registration complete/i',
  'text=/create.*workspace|workspace.*name|name.*workspace/i',  // 新增
  '[data-testid="workspace-name-input"]',                        // 新增
  'input[placeholder*="workspace" i]'                            // 新增
].join(", ")
```

### 2. 改进 Skip 按钮处理

在 `tests/protection-validation.spec.ts` 中：

**增加尝试次数**：从 4 次增加到 6 次，因为可能有多个引导页

**改进逻辑**：
- 找到 Skip 按钮后继续检查是否还有更多
- 添加更多 Skip 按钮选择器（包括 `<a>` 标签）

```typescript
const postRegistrationSkipSelector = [
  'button:has-text("Skip")',
  'button:has-text("跳过")',
  'button.btn-ghost:has-text("Skip")',
  'button.btn-ghost:has(div:has-text("Skip"))',
  'a:has-text("Skip")',      // 新增
  'a:has-text("跳过")'       // 新增
].join(", ");
```

### 3. 增强 Token 提取逻辑

**扩展提取条件**：
```typescript
const shouldExtractTokens =
  finalOutcomeKind === "success" ||
  (finalOutcomeKind === "unknown" &&
   (activePage.url().includes("chatgpt.com") ||
    activePage.url().includes("create-free-workspace")));  // 新增
```

**添加导航回退机制**：
当在工作区创建页面找不到 session token 时，自动导航到 ChatGPT 主页重新获取：

```typescript
if (!sessionToken) {
  console.log('[Token] No session token found, trying alternative methods...');
  
  // 尝试导航到主页来获取 session token
  await activePage.goto('https://chatgpt.com/', { 
    waitUntil: 'domcontentloaded', 
    timeout: 15000 
  });
  await humanDelay(2000, 3000);
  
  // 重新获取 cookies
  const newCookies = await activePage.context().cookies();
  // ... 提取 session token 并调用 API
}
```

## 测试验证

修改完成后，建议运行测试验证：

```bash
npm run test
```

预期结果：
1. 测试能够识别工作区创建页面为成功状态
2. 即使停在工作区创建页面，也能成功提取 token
3. Token 文件正常保存到 `output_tokens/` 目录

## 相关文件

- [src/target.profile.ts](../../src/target.profile.ts) - 成功标记配置
- [tests/protection-validation.spec.ts](../../tests/protection-validation.spec.ts) - 测试流程和 token 提取逻辑
- [src/utils/token-saver.ts](../../src/utils/token-saver.ts) - Token 保存模块

## 注意事项

1. **输出目录结构**：新的测试会在 `output_tokens/` 下创建任务 ID 子目录
2. **文件命名**：包含 `run-N__` 前缀（如果 `PLATFORM_RUN_COUNT > 1`）
3. **Session Token**：ChatGPT 使用 session-based 认证，需要通过 API 交换 access token

## 更新日期

2026-04-06
