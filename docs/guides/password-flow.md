# 密码输入流程说明

## 概述

本项目已实现完整的密码输入功能，参考了 `gpt-register` 项目的密码生成逻辑。

## 密码输入流程

### 1. 邮箱输入阶段
- 用户输入邮箱地址
- 点击"继续"按钮

### 2. 密码输入阶段
- 系统检测到密码输入框出现（选择器已配置）
- 自动输入生成的密码
- 点击"继续"按钮提交

## 密码选择器配置

在 `src/target.profile.ts` 中已配置多个密码输入框选择器：

```typescript
password: [
  'input[type="password"]',
  'input[name="password"]',
  'input[aria-label="密码"]',
  'input[placeholder="密码"]',
  'div._typeableLabelText_18qcl_88:has-text("密码") + input',
  'div._typeableLabelTextPositioner_18qcl_88:has(div._typeableLabelText_18qcl_88:has-text("密码")) input'
].join(", ")
```

这些选择器覆盖了常见的密码输入框模式，包括：
- 标准的 `type="password"` 输入框
- 带有 `name="password"` 属性的输入框
- 带有中文"密码"标签的输入框
- 特定 CSS 类的输入框（如您提供的 `_typeableLabelText_18qcl_88`）

## 密码生成器

密码生成功能位于 `src/utils/user-info-generator.ts`：

```typescript
export function generateRandomPassword(length: number = 16): string {
  const uppercase = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  const lowercase = "abcdefghijklmnopqrstuvwxyz";
  const digits = "0123456789";
  const special = "!@#$%^&*";
  const all = uppercase + lowercase + digits + special;

  let password = "";
  // 确保至少包含每种字符
  password += uppercase[Math.floor(Math.random() * uppercase.length)];
  password += lowercase[Math.floor(Math.random() * lowercase.length)];
  password += digits[Math.floor(Math.random() * digits.length)];
  password += special[Math.floor(Math.random() * special.length)];

  // 填充剩余长度
  for (let i = password.length; i < length; i++) {
    password += all[Math.floor(Math.random() * all.length)];
  }

  // 打乱顺序
  return password
    .split("")
    .sort(() => Math.random() - 0.5)
    .join("");
}
```

### 密码特点
- 默认长度：16 字符
- 包含大写字母、小写字母、数字和特殊字符
- 随机生成，每次运行都不同
- 符合大多数网站的密码强度要求

## 测试流程

在 `tests/protection-validation.spec.ts` 中，密码输入流程如下：

1. **输入邮箱**
   ```typescript
   await humanType(activePage, targetProfile.selectors.email, requireEnv("TARGET_EMAIL"));
   ```

2. **检查密码框是否可见**
   ```typescript
   const passwordField = activePage.locator(targetProfile.selectors.password).first();
   const passwordVisible = await passwordField.isVisible().catch(() => false);
   ```

3. **输入密码（如果可见）**
   ```typescript
   if (passwordVisible) {
     await humanDelay(300, 800);
     await humanType(activePage, targetProfile.selectors.password, requireEnv("TARGET_PASSWORD"));
     passwordFilled = true;
   }
   ```

4. **点击提交后等待密码框出现（如果之前不可见）**
   ```typescript
   if (!passwordFilled) {
     const passwordAppeared = await activePage
       .locator(targetProfile.selectors.password ?? "input[type='password']")
       .first()
       .waitFor({
         state: "visible",
         timeout: 5_000
       })
       .then(() => true)
       .catch(() => false);

     if (passwordAppeared) {
       await humanDelay(500, 1000);
       await humanType(activePage, targetProfile.selectors.password ?? "input[type='password']", requireEnv("TARGET_PASSWORD"));
       passwordFilled = true;
       
       await humanDelay(500, 1200);
       await humanMouseMove(activePage);
       await activePage.locator(targetProfile.selectors.submit).click();
       outcomeStage = "password_submitted";
     }
   }
   ```

## 环境变量配置

在 `.env` 文件中配置密码：

```bash
# 如果使用固定密码
TARGET_PASSWORD=YourPassword123!

# 或者在测试中使用自动生成的密码
# 密码会通过 generateRandomPassword() 自动生成
```

## 人类行为模拟

为了避免被检测为机器人，密码输入使用了以下人类行为模拟：

- **随机延迟**：输入前有 300-800ms 的随机延迟
- **逐字符输入**：使用 `humanType` 函数模拟真实的打字速度
- **鼠标移动**：在点击前模拟鼠标移动
- **自然停顿**：在各个操作之间添加自然的停顿时间

## 故障排除

### 密码框未找到
如果密码框未被正确识别，请检查：
1. 页面 HTML 结构是否与选择器匹配
2. 是否需要添加新的选择器到 `target.profile.ts`
3. 密码框是否在 iframe 中（需要特殊处理）

### 密码输入失败
如果密码输入失败，可能的原因：
1. 密码强度不符合网站要求（调整 `generateRandomPassword` 函数）
2. 输入速度过快被检测（增加 `humanDelay` 时间）
3. 页面有额外的验证逻辑（需要在 `fillOptionalFields` 中处理）

## 参考代码

完整的实现可以参考：
- 密码生成器：`src/utils/user-info-generator.ts`
- 目标配置：`src/target.profile.ts`
- 测试流程：`tests/protection-validation.spec.ts`
- 人类行为模拟：`src/stealth/advanced-stealth.ts`
