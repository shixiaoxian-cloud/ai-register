# 配置界面测试启动问题 - 已解决

## 问题描述

点击配置界面的"开始测试"按钮后，没有看到浏览器窗口弹出，或者运行的是错误的测试。

## 根本原因

1. **多个测试文件** - 项目中有两个测试文件：
   - `tests/protection-validation.spec.ts` - 主要的保护验证测试
   - `tests/debug-tempmail.spec.ts` - 临时邮箱调试测试

2. **测试脚本配置** - 原来的 `npm run test` 和 `npm run test:headed` 会运行所有测试文件，导致运行了调试测试而不是主测试。

## 解决方案

修改了 `package.json` 中的测试脚本，明确指定只运行主要的保护验证测试：

```json
"scripts": {
  "test": "playwright test tests/protection-validation.spec.ts",
  "test:headed": "playwright test tests/protection-validation.spec.ts --headed",
  "test:all": "playwright test",
  "test:all:headed": "playwright test --headed"
}
```

## 修改内容

### 之前
```json
"test": "playwright test",
"test:headed": "playwright test --headed"
```

### 之后
```json
"test": "playwright test tests/protection-validation.spec.ts",
"test:headed": "playwright test tests/protection-validation.spec.ts --headed",
"test:all": "playwright test",
"test:all:headed": "playwright test --headed"
```

## 新增的脚本

- `test:all` - 运行所有测试文件（包括调试测试）
- `test:all:headed` - 以可视模式运行所有测试文件

## 验证结果

修改后，通过配置界面启动测试时：

1. ✅ 只运行 1 个测试（protection-validation.spec.ts）
2. ✅ 生成用户信息和临时邮箱
3. ✅ 使用顶级反检测方案
4. ✅ 执行 Cloudflare 绕过
5. ✅ 浏览器窗口正常显示（headed 模式）

## 测试日志示例

```
Running 1 test using 1 worker
[UserInfo] Generated user info: {
  firstName: 'Thomas',
  lastName: 'Thomas',
  birthday: '2000-11-27',
  password: 'b$if****'
}
[TempMail] Created temporary email: x6x0iyssap@hhxxttxx.us.ci
[TopTier] Setting up top-tier anti-detection...
[Expert] Using expert-level Cloudflare bypass...
[Cloudflare] Starting bypass procedure...
[Cloudflare] Step 1: Visit homepage
[Cloudflare] Step 2: Simulate real user behavior
```

## 使用说明

### 通过配置界面启动测试

1. 访问 http://127.0.0.1:3200
2. 确认测试站点地址已配置
3. 选择运行模式：
   - **无头模式** - 后台运行，不显示浏览器窗口
   - **可视模式** - 显示浏览器窗口，可以观察测试过程
4. 点击"开始测试"
5. 查看实时日志

### 通过命令行启动测试

```bash
# 运行主测试（无头模式）
npm run test

# 运行主测试（可视模式）
npm run test:headed

# 运行所有测试（包括调试测试）
npm run test:all

# 运行所有测试（可视模式）
npm run test:all:headed

# 运行调试测试
npm run debug:test
```

## 故障排除

### 如果仍然看不到浏览器窗口

1. **检查运行模式** - 确保选择了"可视模式"而不是"无头模式"
2. **检查窗口是否被隐藏** - 浏览器窗口可能在后台，按 Alt+Tab 切换
3. **检查进程** - 运行 `tasklist | grep chrome` 查看浏览器进程是否存在
4. **查看日志** - 在配置界面的"实时日志"区域查看详细输出

### 如果测试立即失败

1. **检查配置** - 确保 `.env` 文件配置正确
2. **检查网络** - 确保可以访问测试站点
3. **检查临时邮箱** - 确保临时邮箱 API 可用
4. **查看错误日志** - 在实时日志中查看具体错误信息

## 相关文档

- [配置界面故障排除](config-ui.md) - 配置界面故障排除指南
- [日志查看器集成](../implementation/log-viewer-integration.md) - 日志查看器集成文档
- [密码流程说明](../guides/password-flow.md) - 密码输入流程说明

## 总结

通过修改测试脚本配置，现在配置界面可以正确启动主要的保护验证测试，而不会意外运行调试测试。用户可以通过界面清晰地看到测试进度和日志输出。
