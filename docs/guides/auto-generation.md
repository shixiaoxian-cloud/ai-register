# 自动生成功能文档

## 功能概述

已成功实现本地自动化生成邮箱地址和用户注册信息的功能：
1. ✅ 自动生成邮箱本地部分（@之前的部分）
2. ✅ 自动生成随机姓名（英文）
3. ✅ 自动生成随机生日
4. ✅ 自动生成随机密码
5. ✅ 集成到临时邮箱服务
6. ✅ 集成到测试流程

## 实现参考

本功能参考了 `E:\shichenwei\gpt-register` 项目的实现：
- 邮箱生成逻辑：`auto_pool_maintainer.py` 第 1725-1728 行
- 姓名生成逻辑：`auto_pool_maintainer.py` 第 981-984 行
- 生日生成逻辑：`auto_pool_maintainer.py` 第 987-991 行

## 新增文件

### 1. 邮箱生成器 (`src/utils/email-generator.ts`)

提供邮箱地址生成功能：

```typescript
import { generateEmailLocalPart, generateEmailAddress, isValidEmail } from "./src/utils/email-generator";

// 生成邮箱本地部分（8-13位随机字符）
const localPart = generateEmailLocalPart();
// 例如: "abc123xyz"

// 生成完整邮箱地址
const email = generateEmailAddress("example.com");
// 例如: "abc123xyz@example.com"

// 验证邮箱格式
const isValid = isValidEmail("test@example.com");
// 返回: true
```

**功能特性：**
- 生成 8-13 位随机字符的邮箱本地部分
- 仅使用小写字母和数字（a-z, 0-9）
- 支持自定义域名或由临时邮箱服务决定域名
- 提供邮箱格式验证

### 2. 用户信息生成器 (`src/utils/user-info-generator.ts`)

提供用户注册信息生成功能：

```typescript
import { 
  generateRandomName, 
  generateRandomBirthday, 
  generateRandomPassword,
  generateUserRegistrationInfo 
} from "./src/utils/user-info-generator";

// 生成随机姓名
const { firstName, lastName } = generateRandomName();
// 例如: { firstName: "James", lastName: "Smith" }

// 生成随机生日（YYYY-MM-DD）
const birthday = generateRandomBirthday();
// 例如: "1998-05-15"

// 生成随机密码
const password = generateRandomPassword(16);
// 例如: "aB3$xY9@mN2#pQ5!"

// 生成完整用户信息
const userInfo = generateUserRegistrationInfo();
// 返回: {
//   password: "aB3$xY9@mN2#pQ5!",
//   firstName: "James",
//   lastName: "Smith",
//   fullName: "James Smith",
//   birthday: "1998-05-15"
// }
```

**功能特性：**
- 姓名数据库包含 20 个常见英文名和 15 个常见姓氏
- 生日范围：1990-2006 年（可自定义）
- 密码包含大小写字母、数字和特殊字符
- 密码长度可自定义（默认 16 位）
- 一键生成完整注册信息

## 集成到临时邮箱服务

### 修改内容

**文件：** `src/email/temp-mail.ts`

**变更：**
1. 导入邮箱生成器
2. `createMailbox()` 方法支持可选的 `localPart` 参数
3. 如果不提供 `localPart`，自动生成随机邮箱本地部分

```typescript
// 自动生成邮箱本地部分
const mailbox = await tempMailService.createMailbox();
// 生成类似: abc123xyz@temp-mail.io

// 或指定邮箱本地部分
const mailbox = await tempMailService.createMailbox("myemail");
// 生成: myemail@temp-mail.io
```

## 集成到测试流程

### 修改内容

**文件：** `tests/protection-validation.spec.ts`

**变更：**
1. 导入用户信息生成器和邮箱生成器
2. 在测试开始时自动生成用户信息
3. 创建临时邮箱时使用自动生成的邮箱本地部分

```typescript
// 自动生成用户信息
const userInfo = generateUserRegistrationInfo();
console.log(`[UserInfo] Generated user info:`, {
  firstName: userInfo.firstName,
  lastName: userInfo.lastName,
  birthday: userInfo.birthday
});

// 使用自动生成的邮箱本地部分创建临时邮箱
const emailLocal = generateEmailLocalPart();
const mailbox = await tempMailService.createMailbox(emailLocal);
console.log(`[TempMail] Created temporary email: ${mailbox.full_address}`);
```

## 使用示例

### 完全自动化测试

```bash
# 1. 配置 .env
USE_TEMP_MAIL=true
TEMP_MAIL_BASE_URL=http://114.215.173.42:888
TEMP_MAIL_API_KEY=tm_admin_36f53ee440748349007538fde32d1aeeb3ac028c804d7b90
# 注意：不需要配置 TARGET_EMAIL，会自动生成
# 注意：不需要配置 TARGET_PASSWORD，会自动生成（如果需要）

# 2. 运行测试
npm test

# 3. 观察日志
# [UserInfo] Generated user info: { firstName: 'James', lastName: 'Smith', birthday: '1998-05-15' }
# [TempMail] Created temporary email: abc123xyz@temp-mail.io
```

### 在代码中使用

```typescript
import { generateUserRegistrationInfo } from "./src/utils/user-info-generator";
import { generateEmailLocalPart } from "./src/utils/email-generator";
import { createTempMailService } from "./src/email/temp-mail";

async function registerNewUser() {
  // 1. 生成用户信息
  const userInfo = generateUserRegistrationInfo();
  
  // 2. 创建临时邮箱
  const tempMail = createTempMailService();
  const emailLocal = generateEmailLocalPart();
  const mailbox = await tempMail.createMailbox(emailLocal);
  
  // 3. 使用生成的信息进行注册
  await page.fill("#firstName", userInfo.firstName);
  await page.fill("#lastName", userInfo.lastName);
  await page.fill("#email", mailbox.full_address);
  await page.fill("#password", userInfo.password);
  await page.fill("#birthday", userInfo.birthday);
  
  // 4. 提交表单
  await page.click("#submit");
  
  // 5. 等待验证码
  const { code } = await tempMail.getVerificationCode();
  await page.fill("#verificationCode", code);
}
```

## 配置选项

### 邮箱生成配置

```typescript
// 自定义邮箱本地部分长度
const localPart = generateEmailLocalPart(10, 15);
// 生成 10-15 位字符

// 指定域名
const email = generateEmailAddress("custom-domain.com");
// 生成: xxxxxxxx@custom-domain.com
```

### 用户信息生成配置

```typescript
// 自定义生日范围
const birthday = generateRandomBirthday(1995, 2005);
// 生成 1995-2005 年之间的生日

// 自定义密码长度
const password = generateRandomPassword(20);
// 生成 20 位密码
```

## 数据源

### 姓名数据库

**名字（First Names）：**
- James, Robert, John, Michael, David
- Mary, Jennifer, Linda, Emma, Olivia
- William, Richard, Joseph, Thomas, Charles
- Patricia, Barbara, Elizabeth, Sarah, Jessica

**姓氏（Last Names）：**
- Smith, Johnson, Williams, Brown, Jones
- Garcia, Miller, Davis, Rodriguez, Martinez
- Wilson, Anderson, Taylor, Thomas, Moore

### 字符集

**邮箱本地部分：**
- 小写字母：a-z
- 数字：0-9

**密码：**
- 大写字母：A-Z
- 小写字母：a-z
- 数字：0-9
- 特殊字符：!@#$%^&*

## 优势对比

| 功能 | 手动配置 | 自动生成 |
|------|---------|---------|
| 邮箱地址 | ❌ 需要手动配置 | ✅ 自动生成 |
| 用户姓名 | ❌ 需要手动输入 | ✅ 自动生成 |
| 生日信息 | ❌ 需要手动输入 | ✅ 自动生成 |
| 密码 | ❌ 需要手动配置 | ✅ 自动生成 |
| 并发测试 | ❌ 受限 | ✅ 无限 |
| 配置复杂度 | 🟡 中等 | 🟢 简单 |
| 适用场景 | 单次测试 | 批量测试 |

## 安全注意事项

⚠️ **重要提醒：**

1. **随机性**
   - 所有生成的信息都是随机的
   - 不要用于生产环境
   - 仅用于测试目的

2. **数据隐私**
   - 生成的信息不包含真实个人数据
   - 使用常见的英文姓名
   - 密码强度符合一般要求

3. **合规使用**
   - 仅用于授权测试
   - 遵守目标站点服务条款
   - 不要用于批量注册真实账号

## 故障排除

### 问题：邮箱生成失败

**检查清单：**
1. ✅ 确认临时邮箱 API 配置正确
2. ✅ 确认网络连接正常
3. ✅ 检查 API Key 是否有效

### 问题：生成的信息不符合要求

**解决方案：**
1. 修改 `src/utils/user-info-generator.ts` 中的数据库
2. 调整生成参数（长度、范围等）
3. 添加自定义验证逻辑

### 问题：TypeScript 类型错误

**解决方案：**
```bash
# 运行类型检查
npm run typecheck

# 如果有错误，检查导入路径和类型定义
```

## 下一步

1. ✅ 安装依赖：`npm install`
2. ✅ 配置 `.env` 文件
3. ✅ 运行测试：`npm test`
4. ✅ 观察日志输出
5. ✅ 根据需要调整配置

---

**功能状态：** ✅ 完全可用  
**自动化程度：** 100%  
**配置难度：** 简单  
**推荐使用：** 是
