# Skip 按钮点击拦截问题修复

## 问题描述

测试在点击注册后的 Skip 按钮时失败，出现 `TimeoutError: locator.click: Timeout 15000ms exceeded` 错误。

## 问题分析

### 根本原因

Skip 按钮选择器匹配到了错误的元素 - 可访问性链接 `<a href="#main" data-skip-to-content="">Skip to content</a>`，而不是真正的引导页 Skip 按钮。

### 错误日志

```
locator resolved to <a href="#main" data-skip-to-content="" class="...">Skip to content</a>
<div class="flex min-h-0 flex-1 flex-col items-center justify-center overflow-hidden">…</div> 
from <div class="bg-token-bg-primary absolute inset-0 start-0 top-0 z-50 h-full w-full">…</div> 
subtree intercepts pointer events
```

### 问题表现

1. **第一、二次测试**：点击"Skip to content"链接时被遮罩层拦截
2. **第三次测试**：验证码输入框点击时被标签元素拦截

## 解决方案

### 1. 更新 Skip 按钮选择器

**修改前**：
```typescript
const postRegistrationSkipSelector = [
  'button:has-text("Skip")',
  'button:has-text("跳过")',
  'button.btn-ghost:has-text("Skip")',
  'button.btn-ghost:has(div:has-text("Skip"))',
  'a:has-text("Skip")',      // ← 匹配到可访问性链接
  'a:has-text("跳过")'
].join(", ");
```

**修改后**：
```typescript
const postRegistrationSkipSelector = [
  'button:has-text("Skip"):not([data-skip-to-content])',
  'button:has-text("跳过"):not([data-skip-to-content])',
  'button.btn-ghost:has-text("Skip")',
  'button.btn-ghost:has(div:has-text("Skip"))',
  // 只匹配非可访问性链接的 Skip
  'a:has-text("Skip"):not([data-skip-to-content]):not([href="#main"])',
  'a:has-text("跳过"):not([data-skip-to-content]):not([href="#main"])'
].join(", ");
```

**关键改进**：
- 使用 `:not([data-skip-to-content])` 排除可访问性链接
- 使用 `:not([href="#main"])` 排除页面内跳转链接

### 2. 添加 Force Click 回退机制

#### 在 dismissPostRegistrationOnboarding 函数中

```typescript
if (skipVisible) {
  console.log('[Flow] Preference/onboarding page detected, clicking Skip button');
  await humanDelay(500, 1000);
  await humanMouseMove(page);

  // 先尝试常规点击，失败则使用强制点击
  try {
    await skipButton.click({ timeout: 5000 });
  } catch (error) {
    console.log('[Flow] Regular click failed, trying force click...');
    await skipButton.click({ force: true });
  }

  await humanDelay(2000, 3000);
  console.log('[Flow] Skip button clicked, waiting for the next page');
  skippedAny = true;
  continue;
}
```

#### 在 humanType 函数中

```typescript
export async function humanType(page: Page, selector: string, text: string): Promise<void> {
  const element = page.locator(selector);

  // 先尝试常规点击，失败则使用强制点击
  try {
    await element.click({ timeout: 5000 });
  } catch (error) {
    console.log('[HumanType] Regular click failed, trying force click...');
    await element.click({ force: true });
  }

  await humanDelay(200, 500);

  for (const char of text) {
    await element.pressSequentially(char, { delay: Math.random() * 100 + 50 });
  }

  await humanDelay(300, 800);
}
```

## 测试结果

### 修复前
- 3 次测试全部失败
- 错误：点击被遮罩层拦截
- Token 未保存

### 修复后
- ✅ 测试通过（1 passed）
- ✅ 成功提取 session token
- ✅ 成功获取 access token
- ✅ Token 保存成功

### 测试日志（成功）

```
[Token] Found session token: __Secure-next-auth.session-token
[Token] Session token found: true
[Token] Attempting to fetch access token via API...
[Token] ✓ Successfully fetched access token from API
[Token] ✓ Access token found
Token 已保存: output_tokens\cpa\ij1e0bwb8j@hhxxttxx.us.ci.json
Token 已保存: output_tokens\sub2api\ij1e0bwb8j@hhxxttxx.us.ci.sub2api.json
[Token] ✓ CPA format saved
[Token] ✓ Sub2Api format saved
```

### 保存的 Token 信息

- **邮箱**：`ij1e0bwb8j@hhxxttxx.us.ci`
- **账户 ID**：`900bd766-bc0e-444b-97ab-d57ffdf880b0`
- **用户 ID**：`user-l0Y4YXstLIMryRWri57lEqkw`
- **过期时间**：2026-04-15（约 10 天）
- **格式**：CPA + Sub2Api

## 相关文件

- [tests/protection-validation.spec.ts](../../tests/protection-validation.spec.ts) - Skip 按钮处理逻辑
- [src/stealth/advanced-stealth.ts](../../src/stealth/advanced-stealth.ts) - humanType 函数

## 相关提交

- `bde5d4e` - fix: 修复 Skip 按钮点击拦截问题
- `5c0556d` - fix: 修复工作区创建页面 token 提取失败问题

## 经验总结

1. **选择器精确性很重要**：使用 `:not()` 伪类排除不需要的元素
2. **Force Click 是有效的回退方案**：当元素被遮挡时，`force: true` 可以绕过可见性检查
3. **可访问性元素可能干扰测试**：需要特别注意 `data-skip-to-content` 等可访问性属性
4. **超时设置要合理**：5 秒超时足够检测点击失败，避免长时间等待

## 更新日期

2026-04-06
