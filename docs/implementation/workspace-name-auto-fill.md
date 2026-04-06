# 工作区名称页面自动填写实现

## 问题描述

在注册流程完成后，某些站点会显示工作区名称设置页面，要求用户输入工作区名称并点击 Continue 按钮。之前的实现将此页面识别为成功标记，但不会自动处理，导致流程停在这里。

## 解决方案

创建独立的模块 `src/stealth/post-registration-handler.ts`，将注册后引导页面处理逻辑从测试文件中提取出来，使其成为可复用的模块。

### 实现位置

**模块文件：** `src/stealth/post-registration-handler.ts`
**导出函数：** `dismissPostRegistrationOnboarding(page: Page): Promise<boolean>`
**调用位置：** `tests/protection-validation.spec.ts` 第 1056 行

### 模块化优势

1. **代码复用** - 其他测试或模块可以导入使用
2. **关注点分离** - 测试文件专注于测试流程，业务逻辑在 src/ 中
3. **易于维护** - 逻辑集中在一个模块中
4. **符合项目架构** - 与现有的 stealth 模块保持一致

### 处理逻辑

函数会在循环中依次检查以下页面类型：

1. **工作账号选择页面** - 点击 "Start a personal account"
2. **Skip 按钮** - 点击 Skip 跳过引导页
3. **工作区名称页面** - 填写工作区名称并点击 Continue

### 工作区名称页面处理流程

1. 检测工作区名称输入框（支持多种选择器）：
   - `input[name="workspace-name"]`
   - `input[placeholder*="Acme Inc" i]`
   - `input[placeholder*="workspace" i]`
   - `[data-testid="workspace-name-input"]`

2. 检查输入框是否已有默认值：
   - 如果有值，保持不变
   - 如果为空，填入 "My Workspace"

3. 查找并点击 Continue 按钮（支持多种选择器）：
   - `button:has-text("Continue")`
   - `button[type="submit"]:has-text("Continue")`
   - `button.btn-primary:has-text("Continue")`
   - `button[class*="primary"]:has-text("Continue")`

4. 使用人类行为模拟：
   - `humanDelay` - 随机延迟
   - `humanMouseMove` - 鼠标移动
   - `humanType` - 模拟打字

### 错误处理

- 如果常规点击失败，会尝试强制点击（`force: true`）
- 如果找到输入框但没有找到 Continue 按钮，会记录警告日志

### 日志输出

```
[Flow] Found workspace name input: input[placeholder*="workspace" i]
[Flow] Workspace name page detected, filling and clicking Continue
[Flow] Current workspace name value: "Olivia Moore's Workspace"
[Flow] Using existing workspace name
[Flow] Found Continue button: button:has-text("Continue")
[Flow] Continue button clicked, waiting for the next page
```

## 测试验证

运行测试时，如果遇到工作区名称页面，会自动：
1. 检测输入框
2. 填写或保持现有名称
3. 点击 Continue
4. 继续后续流程

## 相关文件

- `src/stealth/post-registration-handler.ts` - 注册后引导页面处理模块
- `tests/protection-validation.spec.ts` - 主测试文件（导入并使用该模块）
- `src/stealth/advanced-stealth.ts` - 人类行为模拟函数（humanDelay、humanMouseMove、humanType）
- `src/target.profile.ts` - 工作区页面选择器配置

## 注意事项

- 工作区名称页面仍然保留在 `success` 选择器中，作为成功标记
- 自动处理逻辑不会影响成功检测
- 如果页面结构变化，可能需要更新选择器
- 该模块可以被其他测试或功能复用

---

**创建时间**: 2026-04-06
**修改文件**: 
- `src/stealth/post-registration-handler.ts` (新建)
- `tests/protection-validation.spec.ts` (重构)
