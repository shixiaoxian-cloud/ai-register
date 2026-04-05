# 全名和生日填写功能

## 概述

实现了自动填写全名和生日的功能，完全参考 gpt-register 项目的生成逻辑。

## 功能实现

### 1. 名称生成

参考 gpt-register 的 `generate_random_name` 函数：

**Python (gpt-register):**
```python
def generate_random_name() -> tuple[str, str]:
    first = ["James", "Robert", "John", "Michael", "David", "Mary", "Jennifer", "Linda", "Emma", "Olivia"]
    last = ["Smith", "Johnson", "Williams", "Brown", "Jones", "Garcia", "Miller"]
    return random.choice(first), random.choice(last)
```

**TypeScript (ai-register):**
```typescript
const FIRST_NAMES = [
  "James", "Robert", "John", "Michael", "David",
  "Mary", "Jennifer", "Linda", "Emma", "Olivia",
  "William", "Richard", "Joseph", "Thomas", "Charles",
  "Patricia", "Barbara", "Elizabeth", "Sarah", "Jessica"
];

const LAST_NAMES = [
  "Smith", "Johnson", "Williams", "Brown", "Jones",
  "Garcia", "Miller", "Davis", "Rodriguez", "Martinez",
  "Wilson", "Anderson", "Taylor", "Thomas", "Moore"
];
```

### 2. 生日生成

参考 gpt-register 的 `generate_random_birthday` 函数：

**Python (gpt-register):**
```python
def generate_random_birthday() -> str:
    year = random.randint(1996, 2006)
    month = random.randint(1, 12)
    day = random.randint(1, 28)
    return f"{year:04d}-{month:02d}-{day:02d}"
```

**TypeScript (ai-register):**
```typescript
export function generateRandomBirthday(
  minYear: number = 1996,
  maxYear: number = 2006
): string {
  const year = Math.floor(Math.random() * (maxYear - minYear + 1)) + minYear;
  const month = Math.floor(Math.random() * 12) + 1;
  const day = Math.floor(Math.random() * 28) + 1;
  
  return `${year.toString().padStart(4, "0")}-${month.toString().padStart(2, "0")}-${day.toString().padStart(2, "0")}`;
}
```

**特点：**
- 年份范围：1996-2006（与 gpt-register 一致）
- 月份范围：1-12
- 日期范围：1-28（避免月份天数问题）

## HTML 结构分析

### 全名输入框

```html
<div class="_typeableLabelTextPositioner_18qcl_88">
  <div class="_typeableLabelText_18qcl_88">全名</div>
</div>
```

### 生日日期选择器

```html
<div id="_r_v_-birthday" role="group">
  <!-- 年份 -->
  <div role="spinbutton" data-type="year" contenteditable="true">2026</div>
  <div data-type="literal">/</div>
  
  <!-- 月份 -->
  <div role="spinbutton" data-type="month" contenteditable="true">04</div>
  <div data-type="literal">/</div>
  
  <!-- 日期 -->
  <div role="spinbutton" data-type="day" contenteditable="true">05</div>
</div>

<!-- 隐藏的输入框 -->
<input type="hidden" value="2026-04-05" name="birthday">
```

### 完成按钮

```html
<button type="submit" data-dd-action-name="Continue">
  完成帐户创建
</button>
```

## 选择器配置

在 `target.profile.ts` 中配置：

```typescript
selectors: {
  // 全名输入框
  fullName: [
    'input[name="name"]',
    'input[aria-label="全名"]',
    'input[placeholder="全名"]',
    'div._typeableLabelText_18qcl_88:has-text("全名") + input',
    'div._typeableLabelTextPositioner_18qcl_88:has(div._typeableLabelText_18qcl_88:has-text("全名")) input'
  ].join(", "),
  
  // 生日年份
  birthdayYear: [
    'div[role="spinbutton"][data-type="year"]',
    'div[aria-label*="年"]',
    'input[name="birthday-year"]'
  ].join(", "),
  
  // 生日月份
  birthdayMonth: [
    'div[role="spinbutton"][data-type="month"]',
    'div[aria-label*="月"]',
    'input[name="birthday-month"]'
  ].join(", "),
  
  // 生日日期
  birthdayDay: [
    'div[role="spinbutton"][data-type="day"]',
    'div[aria-label*="日"]',
    'input[name="birthday-day"]'
  ].join(", "),
  
  // 完成按钮
  completeAccountButton: [
    'button[type="submit"]:has-text("完成帐户创建")',
    'button[type="submit"]:has-text("Complete account creation")',
    'button[data-dd-action-name="Continue"][type="submit"]',
    'button[type="submit"]'
  ].join(", ")
}
```

## 填写流程

```typescript
// 1. 检测全名输入框是否可见
const fullNameVisible = await activePage
  .locator(targetProfile.selectors.fullName)
  .first()
  .isVisible()
  .catch(() => false);

if (fullNameVisible) {
  console.log('[Flow] Full name and birthday input detected');

  // 2. 填写全名
  const fullName = `${userInfo.firstName} ${userInfo.lastName}`;
  await humanType(activePage, targetProfile.selectors.fullName!, fullName);

  // 3. 填写生日
  const [year, month, day] = userInfo.birthday.split('-');

  // 填写年份
  const yearField = activePage.locator(targetProfile.selectors.birthdayYear).first();
  await yearField.click();
  await yearField.fill('');
  await humanType(activePage, targetProfile.selectors.birthdayYear, year);

  // 填写月份
  const monthField = activePage.locator(targetProfile.selectors.birthdayMonth).first();
  await monthField.click();
  await monthField.fill('');
  await humanType(activePage, targetProfile.selectors.birthdayMonth, month);

  // 填写日期
  const dayField = activePage.locator(targetProfile.selectors.birthdayDay).first();
  await dayField.click();
  await dayField.fill('');
  await humanType(activePage, targetProfile.selectors.birthdayDay, day);

  // 4. 点击完成按钮
  await activePage.locator(targetProfile.selectors.completeAccountButton).click();
}
```

## 关键特性

### 1. 自动检测

在验证码处理后，自动检测是否需要填写全名和生日：

```typescript
await humanDelay(2000, 3000);

const fullNameVisible = targetProfile.selectors.fullName
  ? await activePage
      .locator(targetProfile.selectors.fullName)
      .first()
      .isVisible()
      .catch(() => false)
  : false;
```

### 2. 人类行为模拟

所有输入都使用 `humanType` 和 `humanDelay`：

```typescript
await humanDelay(500, 1000);
await humanType(activePage, targetProfile.selectors.fullName!, fullName);

await humanDelay(500, 800);
await yearField.click();
await yearField.fill('');
await humanType(activePage, targetProfile.selectors.birthdayYear, year);
```

### 3. 清空后输入

对于 `contenteditable` 的生日字段，先清空再输入：

```typescript
await yearField.click();
await yearField.fill('');  // 清空现有内容
await humanType(activePage, targetProfile.selectors.birthdayYear, year);
```

### 4. 详细日志

```
[Flow] Full name and birthday input detected
[UserInfo] Filling full name: James Smith
[UserInfo] Filling birthday: 2001-05-15
```

## 完整注册流程

```
输入邮箱
  ↓
输入密码 或 验证码
  ↓
输入验证码 或 密码
  ↓
填写全名 ✓ 新增
  ↓
填写生日 ✓ 新增
  ↓
点击完成账户创建
  ↓
注册完成
```

## 生成的示例数据

```json
{
  "firstName": "James",
  "lastName": "Smith",
  "fullName": "James Smith",
  "birthday": "2001-05-15",
  "password": "aB3!xYz9Kp2mN5qR"
}
```

## 兼容性

与 gpt-register 完全一致：
- ✓ 相同的名称列表
- ✓ 相同的生日范围（1996-2006）
- ✓ 相同的日期格式（YYYY-MM-DD）
- ✓ 相同的生成逻辑

## 相关文件

- [src/utils/user-info-generator.ts](../src/utils/user-info-generator.ts) - 用户信息生成器
- [src/target.profile.ts](../src/target.profile.ts) - 选择器配置
- [src/types.ts](../src/types.ts) - 类型定义
- [tests/protection-validation.spec.ts](../tests/protection-validation.spec.ts) - 测试实现
