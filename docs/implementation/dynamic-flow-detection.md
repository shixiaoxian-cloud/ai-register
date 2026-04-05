# 动态流程识别功能

## 概述

实现了智能识别注册流程的功能，能够自动适配两种不同的流程：
1. **邮箱 → 验证码 → 密码**
2. **邮箱 → 密码 → 验证码**（或直接完成）

## 问题背景

在实际使用中发现，输入邮箱地址后，系统可能会：
- 有时候直接要求输入验证码
- 有时候要求输入密码

这种不确定性需要代码能够动态识别并适配。

## 解决方案

### 流程检测逻辑

```typescript
// 1. 输入邮箱并提交
await humanType(activePage, targetProfile.selectors.email, email);
await activePage.locator(targetProfile.selectors.submit).click();

// 2. 等待页面响应
await humanDelay(2000, 3000);

// 3. 检测下一步是什么
const codeInputAppeared = await activePage
  .locator(targetProfile.selectors.emailCodeInput)
  .first()
  .isVisible()
  .catch(() => false);

if (codeInputAppeared) {
  // 流程 A: 邮箱 → 验证码
  console.log('[Flow] Email verification code input detected');
  // 处理验证码...
  
  // 验证码后再检查是否需要密码
  const passwordAfterCode = await activePage
    .locator(targetProfile.selectors.password)
    .first()
    .isVisible()
    .catch(() => false);
    
  if (passwordAfterCode) {
    // 输入密码
  }
} else {
  // 流程 B: 邮箱 → 密码
  const passwordAppeared = await activePage
    .locator(targetProfile.selectors.password)
    .first()
    .waitFor({ state: "visible", timeout: 5_000 })
    .then(() => true)
    .catch(() => false);
    
  if (passwordAppeared) {
    console.log('[Flow] Password input detected');
    // 处理密码...
  }
}
```

## 支持的流程

### 流程 1: 邮箱 → 验证码 → 密码

```
用户输入邮箱
    ↓
点击继续
    ↓
系统要求输入验证码 ✓ 检测到验证码输入框
    ↓
获取并输入验证码
    ↓
点击继续
    ↓
系统要求输入密码 ✓ 检测到密码输入框
    ↓
输入密码
    ↓
点击继续
    ↓
完成
```

### 流程 2: 邮箱 → 密码 → (可能的验证码)

```
用户输入邮箱
    ↓
点击继续
    ↓
系统要求输入密码 ✓ 检测到密码输入框
    ↓
输入密码
    ↓
点击继续
    ↓
可能要求验证码（通过 waitForKnownOutcome 检测）
    ↓
完成
```

## 关键特性

### 1. 主动检测

在每次提交后，主动检测页面上出现的输入框类型：

```typescript
// 检测验证码输入框
const codeInputAppeared = await activePage
  .locator(targetProfile.selectors.emailCodeInput)
  .first()
  .isVisible()
  .catch(() => false);

// 检测密码输入框
const passwordAppeared = await activePage
  .locator(targetProfile.selectors.password)
  .first()
  .isVisible()
  .catch(() => false);
```

### 2. 双重保障

除了主动检测，还保留了 `waitForKnownOutcome` 的被动检测：

```typescript
// 主动检测处理完后，再次检查
let outcome = await waitForKnownOutcome(
  activePage,
  targetProfile.selectors,
  30_000
);

// 如果仍然检测到需要验证码
if (outcome.kind === "email_code_requested") {
  // 处理验证码...
}
```

### 3. 灵活的顺序

无论验证码和密码以什么顺序出现，都能正确处理：

- **验证码优先**：先检测验证码，处理完后再检测密码
- **密码优先**：先检测密码，处理完后通过 outcome 检测验证码
- **混合流程**：支持任意组合

## 日志输出

为了便于调试，添加了详细的流程日志：

```
[Flow] Detecting next step after email submission...
[Flow] Email verification code input detected
[TempMail] Waiting for verification email...
[TempMail] Received email from: no-reply@openai.com
[TempMail] Extracted verification code: 123456
[Flow] Password input detected after email verification
[Flow] Password input detected
```

## 选择器配置

确保在 `target.profile.ts` 中配置了所有必要的选择器：

```typescript
selectors: {
  email: '...',
  password: '...',
  emailCodeInput: '...',
  emailCodeSubmit: '...',
  submit: '...'
}
```

## 错误处理

如果检测到验证码但配置未启用：

```typescript
if (!targetProfile.emailVerification?.enabled) {
  throw new Error(
    "页面要求输入邮箱验证码，但 target.profile 中未启用 emailVerification。"
  );
}
```

## 时间控制

在每次检测前都有适当的延迟，确保页面完全加载：

```typescript
// 等待页面响应
await humanDelay(2000, 3000);

// 验证码提交后再次等待
await humanDelay(2000, 3000);
```

## 优势

1. **自动适配**：无需手动配置流程顺序
2. **鲁棒性强**：支持多种流程变化
3. **易于调试**：详细的日志输出
4. **双重保障**：主动检测 + 被动检测
5. **人类行为**：所有操作都模拟真实用户行为

## 测试建议

1. 测试邮箱 → 验证码 → 密码流程
2. 测试邮箱 → 密码 → 验证码流程
3. 测试邮箱 → 密码（无验证码）流程
4. 检查日志输出是否正确识别流程

## 相关文件

- [tests/protection-validation.spec.ts](../tests/protection-validation.spec.ts) - 主测试文件
- [src/target.profile.ts](../src/target.profile.ts) - 选择器配置
- [src/protection.ts](../src/protection.ts) - waitForKnownOutcome 实现
