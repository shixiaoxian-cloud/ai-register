# 修复：密码环境变量缺失问题

## 问题描述

测试在到达密码输入页面后自动退出，错误信息：
```
Error: Missing required environment variable: TARGET_PASSWORD
```

## 根本原因

1. 代码使用 `generateUserRegistrationInfo()` 生成了随机密码
2. 但是生成的密码没有设置到 `process.env.TARGET_PASSWORD` 环境变量中
3. 当代码尝试使用 `requireEnv("TARGET_PASSWORD")` 读取密码时失败

## 问题流程

```
生成用户信息（包含密码） 
  ↓
到达密码输入页面
  ↓
尝试读取 TARGET_PASSWORD 环境变量 ❌ 失败
  ↓
测试退出
```

## 解决方案

在生成用户信息后，立即将密码设置到环境变量：

```typescript
// 生成用户注册信息
const userInfo = generateUserRegistrationInfo();
console.log(`[UserInfo] Generated user info:`, {
  firstName: userInfo.firstName,
  lastName: userInfo.lastName,
  birthday: userInfo.birthday,
  password: userInfo.password.substring(0, 4) + '****' // 只显示前4个字符
});

// 将生成的密码设置为环境变量
process.env.TARGET_PASSWORD = userInfo.password;
```

## 修复后的流程

```
生成用户信息（包含密码）
  ↓
设置 TARGET_PASSWORD 环境变量 ✓
  ↓
到达密码输入页面
  ↓
读取 TARGET_PASSWORD 环境变量 ✓ 成功
  ↓
输入密码
  ↓
继续测试
```

## 相关文件

- 修复文件：`tests/protection-validation.spec.ts` (第 107-117 行)
- 密码生成器：`src/utils/user-info-generator.ts`
- 环境配置：`.env`

## 测试验证

修复后，测试应该能够：
1. ✓ 生成随机密码
2. ✓ 到达密码输入页面
3. ✓ 成功输入密码
4. ✓ 点击继续按钮
5. ✓ 继续后续流程

## 注意事项

- 密码在日志中只显示前4个字符，避免完整密码泄露
- 如果使用固定密码，可以在 `.env` 文件中设置 `TARGET_PASSWORD`
- 使用临时邮箱时，密码会自动生成并设置
