# Token 保存问题完整解决方案

## 问题报告

用户报告：最后一次测试为什么没有保存 token？

## 问题分析

### 初步发现

通过查看 `output_tokens/task-run-mnmbfv73-75fcci/` 目录，发现该测试实际上**已经成功保存了 token**：
- CPA 格式：`cpa/run-1__bwvghrz36s@hhxxttxx.us.ci.json`
- Sub2Api 格式：`sub2api/run-1__bwvghrz36s@hhxxttxx.us.ci.sub2api.json`

### 深入调查

查看最新的测试日志发现真正的问题：

```
[Flow] Final outcome detected: unknown
[STAGE] 人工完成挑战后 | unknown | https://chatgpt.com/create-free-workspace?account_id=...
[Token] Session token found: false
[Token] ⚠ No access token found in page storage
```

**根本原因**：注册流程在新的引导页面停止，导致无法提取 token。

## 发现的问题

### 问题 1：工作区创建页面 Token 提取失败
- 页面停在 `https://chatgpt.com/create-free-workspace`
- 该页面上没有 session token
- 成功标记不匹配，导致状态为 `unknown`

### 问题 2：Skip 按钮点击被拦截
- 选择器匹配到错误的"Skip to content"可访问性链接
- 点击被遮罩层拦截，导致 `TimeoutError`
- 测试失败，无法继续

### 问题 3：工作账号选择页面未处理
- 注册后出现"How do you plan to use ChatGPT for work?"页面
- 需要点击"Start a personal account"才能继续
- 原代码没有处理这个页面

## 实施的解决方案

### 解决方案 1：增强 Token 提取逻辑

**文件**：`tests/protection-validation.spec.ts`

**修改内容**：
1. 扩展 token 提取条件，包含工作区创建页面
2. 添加导航回退机制：
   ```typescript
   if (!sessionToken) {
     console.log('[Token] No session token found, trying alternative methods...');
     await activePage.goto('https://chatgpt.com/', { 
       waitUntil: 'domcontentloaded', 
       timeout: 15000 
     });
     // 重新获取 cookies 和 session token
   }
   ```

**文件**：`src/target.profile.ts`

**修改内容**：
添加工作区创建页面的成功标记：
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

### 解决方案 2：修复 Skip 按钮点击拦截

**文件**：`tests/protection-validation.spec.ts`

**修改内容**：
1. 更新选择器，排除可访问性链接：
   ```typescript
   const postRegistrationSkipSelector = [
     'button:has-text("Skip"):not([data-skip-to-content])',
     'button:has-text("跳过"):not([data-skip-to-content])',
     'button.btn-ghost:has-text("Skip")',
     'button.btn-ghost:has(div:has-text("Skip"))',
     'a:has-text("Skip"):not([data-skip-to-content]):not([href="#main"])',
     'a:has-text("跳过"):not([data-skip-to-content]):not([href="#main"])'
   ].join(", ");
   ```

2. 添加 force click 回退机制：
   ```typescript
   try {
     await skipButton.click({ timeout: 5000 });
   } catch (error) {
     console.log('[Flow] Regular click failed, trying force click...');
     await skipButton.click({ force: true });
   }
   ```

**文件**：`src/stealth/advanced-stealth.ts`

**修改内容**：
在 `humanType` 函数中添加相同的 force click 回退机制。

### 解决方案 3：处理工作账号选择页面

**文件**：`tests/protection-validation.spec.ts`

**修改内容**：
在 `dismissPostRegistrationOnboarding` 函数中添加检测和处理：
```typescript
// 首先检查是否有工作账号选择页面（多种选择器）
const personalAccountSelectors = [
  'a:has-text("Start a personal account")',
  'a:has-text("start a personal account")',
  'a[href*="personal"]',
  'button:has-text("For my own work tasks")',
  'button[value="personal"]'
];

for (const selector of personalAccountSelectors) {
  const link = page.locator(selector).first();
  const visible = await link.isVisible().catch(() => false);
  if (visible) {
    console.log(`[Flow] Found personal account selector: ${selector}`);
    await link.click({ timeout: 5000 });
    break;
  }
}
```

## 测试结果

### 修复前
- ❌ 3 次测试全部失败
- ❌ Token 未保存
- ❌ 错误：点击被拦截、页面停在工作区创建页面

### 修复后
- ✅ 测试通过（1 passed）
- ✅ 成功检测工作账号选择页面
- ✅ 成功点击"Start a personal account"
- ✅ 成功提取 session token
- ✅ 成功获取 access token
- ✅ Token 保存成功（CPA + Sub2Api 格式）

### 最终测试日志（成功）

```
[Flow] Found personal account selector: a:has-text("Start a personal account")
[Flow] Work account selection page detected, clicking personal account option
[Flow] Personal account option clicked, waiting for the next page
[Flow] Checking for success indicators on page: https://chatgpt.com/
[Token] Found session token: __Secure-next-auth.session-token
[Token] Session token found: true
[Token] Attempting to fetch access token via API...
[Token] ✓ Successfully fetched access token from API
[Token] ✓ Access token found
Token 已保存: output_tokens\cpa\rx30suhiri@hhxxttxx.us.ci.json
Token 已保存: output_tokens\sub2api\rx30suhiri@hhxxttxx.us.ci.sub2api.json
[Token] ✓ CPA format saved
[Token] ✓ Sub2Api format saved
```

### 保存的 Token 信息

- **邮箱**：`rx30suhiri@hhxxttxx.us.ci`
- **账户 ID**：`73848278-eed6-4aec-9831-a3ab2e20cc51`
- **用户 ID**：`user-BBVcRnlGRUQNUL6NwrrysABj`
- **过期时间**：2026-04-15（约 10 天）
- **格式**：CPA (7.4KB) + Sub2Api (3.2KB)

## Git 提交记录

```
83486b5 - fix: 改进工作账号选择页面检测
1ba7770 - feat: 添加工作账号选择页面处理
a6505ee - docs: 添加 Skip 按钮点击拦截问题修复文档
bde5d4e - fix: 修复 Skip 按钮点击拦截问题
5c0556d - fix: 修复工作区创建页面 token 提取失败问题
```

## 相关文档

- [token-extraction-failure.md](./token-extraction-failure.md) - Token 提取失败问题排查
- [skip-button-click-interception.md](./skip-button-click-interception.md) - Skip 按钮点击拦截修复

## 关键经验总结

1. **问题诊断要全面**：不要只看表面现象，要深入查看日志和页面状态
2. **选择器要精确**：使用 `:not()` 伪类排除不需要的元素
3. **Force Click 是有效的回退方案**：当元素被遮挡时很有用
4. **多种选择器提高成功率**：同一个功能可能有多种实现方式
5. **详细日志很重要**：帮助快速定位问题

## 更新日期

2026-04-06

## 状态

✅ 已解决 - 所有测试通过，Token 成功保存
