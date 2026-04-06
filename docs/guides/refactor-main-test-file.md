# 主测试文件重构指南

本文档说明如何将 `protection-validation.spec.ts` 重构为使用场景模块。

## 重构步骤

### 步骤 1：更新导入语句

**删除以下导入：**
```typescript
import { waitForEmailCode } from "../src/email/imap";
import {
  bypassCloudflare,
  detectCloudflareBlock,
  waitForPageLoad
} from "../src/stealth/expert-bypass";
import { dismissPostRegistrationOnboarding } from "../src/stealth/post-registration-handler";
import { saveTokenToMultipleFormats } from "../src/utils/token-saver";
import type { TokenData } from "../src/utils/token-saver";
```

**添加以下导入：**
```typescript
// 导入通用模块
import {
  RetryableRegistrationFailure,
  throwIfRegistrationFailed
} from "./common/error-handling";
import {
  recordOutcome,
  attachSummary
} from "./common/outcome-recorder";
import {
  isPreAuthChallengePage
} from "./common/page-helpers";

// 导入场景模块
import {
  waitForVerificationCodeWithRetry,
  submitEmailVerificationCode
} from "./scenarios/email-verification/email-helpers";
import {
  performCloudflareBypass
} from "./scenarios/cloudflare/cloudflare-helpers";
import {
  fillAccountDetails,
  needsAccountDetails
} from "./scenarios/account-details/account-helpers";
import {
  extractAndSaveTokens
} from "./scenarios/token-extraction/token-helpers";
import {
  handlePostRegistration,
  waitAndHandlePostRegistration
} from "./scenarios/post-registration/post-registration-helpers";
import { aggregateSub2ApiFiles } from "../src/utils/sub2api-aggregator";
```

### 步骤 2：删除重复的辅助函数

**删除以下函数定义（已在 common/ 和 scenarios/ 中）：**

1. `attachSummary()` - 已在 `common/outcome-recorder.ts`
2. `getStageLabel()` - 已在 `common/outcome-recorder.ts`
3. `recordOutcome()` - 已在 `common/outcome-recorder.ts`
4. `RetryableRegistrationFailure` 类 - 已在 `common/error-handling.ts`
5. `detectRegistrationFailure()` - 已在 `common/error-handling.ts`
6. `throwIfRegistrationFailed()` - 已在 `common/error-handling.ts`
7. `fillPasswordIfVisible()` - 已在 `common/page-helpers.ts`
8. `isPreAuthChallengePage()` - 已在 `common/page-helpers.ts`
9. `resolvePositiveInteger()` - 已在 `common/page-helpers.ts`
10. `getErrorMessage()` - 已在 `common/error-handling.ts`
11. `isEmailWaitTimeoutError()` - 已在 `common/error-handling.ts`
12. `getAgeFromBirthday()` - 已在 `common/page-helpers.ts`
13. `getEmailVerificationRetryPolicy()` - 已在 `scenarios/email-verification/email-helpers.ts`
14. `clickEmailVerificationResend()` - 已在 `scenarios/email-verification/email-helpers.ts`
15. `waitForVerificationCodeOnce()` - 已在 `scenarios/email-verification/email-helpers.ts`
16. `waitForVerificationCodeWithRetry()` - 已在 `scenarios/email-verification/email-helpers.ts`
17. `submitEmailVerificationCode()` - 已在 `scenarios/email-verification/email-helpers.ts`

**删除常量：**
```typescript
const defaultEmailCodeWaitTimeoutMs = 30_000;
const defaultEmailCodeResendAttempts = 1;
```

### 步骤 3：替换 Cloudflare 绕过逻辑

**查找（约在 line 518-570）：**
```typescript
// 使用专家级 Cloudflare 绕过方案
const targetUrl = new URL(startUrl);
const needsCloudflareBypass = targetUrl.host.includes('chatgpt.com') || targetUrl.host.includes('openai.com');

if (needsCloudflareBypass) {
  console.log('[Expert] Using expert-level Cloudflare bypass...');
  const bypassSuccess = await bypassCloudflare(page, context, startUrl);

  if (!bypassSuccess) {
    recordOutcome(
      summary,
      "before_login",
      "blocked",
      "Cloudflare 高级验证失败，页面被拦截",
      page
    );

    await page.screenshot({
      path: testInfo.outputPath("cloudflare-blocked.png"),
      fullPage: true
    });

    throw new Error(
      "Cloudflare 验证失败。页面显示 'Incompatible browser extension or network configuration'。" +
      "建议：1) 使用真实浏览器 Profile；2) 检查网络设置；3) 尝试住宅代理。"
    );
  }

  console.log('[Expert] ✓ Cloudflare bypass successful');
} else {
  // 非 ChatGPT 站点，直接访问
  await humanDelay(1000, 2000);
  await page.goto(startUrl, { waitUntil: "domcontentloaded", timeout: 30000 });
  await waitForPageLoad(page);
}

// 检查是否仍然被拦截
const isBlocked = await detectCloudflareBlock(page);
if (isBlocked) {
  recordOutcome(
    summary,
    "before_login",
    "blocked",
    "目标页面仍然被 Cloudflare 拦截",
    page
  );

  await page.screenshot({
    path: testInfo.outputPath("target-page-blocked.png"),
    fullPage: true
  });

  throw new Error("目标页面被 Cloudflare 拦截，无法继续测试");
}
```

**替换为：**
```typescript
// 使用 Cloudflare 绕过场景模块
const bypassResult = await performCloudflareBypass(page, context, startUrl);

if (!bypassResult.success) {
  recordOutcome(
    summary,
    "before_login",
    "blocked",
    bypassResult.error || "Cloudflare 验证失败",
    page
  );

  await page.screenshot({
    path: testInfo.outputPath("cloudflare-blocked.png"),
    fullPage: true
  });

  throw new Error(
    bypassResult.error || "Cloudflare 验证失败。" +
    "建议：1) 使用真实浏览器 Profile；2) 检查网络设置；3) 尝试住宅代理。"
  );
}
```

### 步骤 4：替换账户资料填写逻辑

**查找（约在 line 777-921）：**
```typescript
// 检查是否需要填写账户资料（全名、年龄或生日）
await humanDelay(2000, 3000);

console.log(`[Flow] Checking post-registration onboarding on page: ${activePage.url()}`);
const handledPostRegistrationOnboarding =
  await dismissPostRegistrationOnboarding(activePage);
if (handledPostRegistrationOnboarding) {
  console.log(
    `[Flow] Post-registration onboarding handled, current URL: ${activePage.url()}`
  );
  await humanDelay(1000, 1500);
}

const fullNameVisible = targetProfile.selectors.fullName
  ? await activePage
      .locator(targetProfile.selectors.fullName)
      .first()
      .isVisible()
      .catch(() => false)
  : false;

// ... 大量的账户资料填写代码 ...

if (fullNameVisible || ageFieldVisible || birthdayFieldVisible) {
  // ... 填写逻辑 ...
}
```

**替换为：**
```typescript
// 检查是否需要填写账户资料
await humanDelay(2000, 3000);

console.log(`[Flow] Checking post-registration onboarding on page: ${activePage.url()}`);
await handlePostRegistration(activePage);

const needs = await needsAccountDetails(activePage);

if (needs.fullName || needs.age || needs.birthday) {
  await fillAccountDetails(activePage, userInfo);

  await throwIfRegistrationFailed(
    activePage,
    "after_manual_challenge",
    summary,
    testInfo
  );

  // 等待页面跳转并处理引导页
  await waitAndHandlePostRegistration(activePage);

  // 等待最终结果
  console.log(`[Flow] Checking for success indicators on page: ${activePage.url()}`);
  outcome = await waitForKnownOutcomeWithFailureHandling(
    activePage,
    targetProfile.selectors,
    30_000,
    "after_manual_challenge",
    summary,
    testInfo
  );
  console.log(`[Flow] Final outcome detected: ${outcome.kind}`);
  recordOutcome(
    summary,
    "after_manual_challenge",
    outcome.kind,
    outcome.details,
    activePage
  );
  finalOutcomeKind = outcome.kind;
}
```

### 步骤 5：替换 Token 提取逻辑

**查找（约在 line 960-1190）：**
```typescript
if (shouldExtractTokens) {
  console.log('[Token] Registration completed, attempting to extract tokens...');

  try {
    // 等待页面稳定
    await humanDelay(2000, 3000);

    // 尝试从 cookies 中提取 session token
    const cookies = await activePage.context().cookies();
    // ... 大量的 token 提取代码 ...
  } catch (error) {
    console.error('[Token] Failed to extract or save tokens:', error);
  }
}
```

**替换为：**
```typescript
if (shouldExtractTokens) {
  await extractAndSaveTokens(activePage, testInfo, userInfo, tempMailbox);
}
```

### 步骤 6：验证重构

运行测试验证重构正确性：

```bash
npm test
```

## 预期效果

重构后的 `protection-validation.spec.ts` 应该：
- 从 ~1288 行减少到 ~800 行
- 所有辅助函数调用改为模块导入
- 测试逻辑保持不变
- 所有测试继续通过

## 回滚方案

如果重构出现问题，可以使用 git 恢复：

```bash
git checkout tests/protection-validation.spec.ts
```

---

**建议：** 在重构前创建一个新分支，以便出现问题时快速回滚。

```bash
git checkout -b refactor/test-architecture
```
