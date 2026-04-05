# 日志查看器集成文档

## 概述

配置界面现已集成增强的实时日志查看器，提供彩色日志、搜索过滤和自动滚动等功能。

## 功能特性

### 1. 彩色日志显示

日志查看器支持语法高亮，不同类型的日志条目使用不同颜色：

- **TempMail** - 蓝色 (#4fc1ff)
- **Flow** - 青色 (#4ec9b0)
- **UserInfo** - 紫色 (#c586c0)
- **Expert** - 黄色 (#dcdcaa)
- **TopTier** - 橙色 (#ce9178)
- **DEBUG** - 灰色 (#858585)
- **ERROR** - 红色 (#f48771)
- **WARNING** - 黄色 (#dcdcaa)
- **SUCCESS** - 绿色 (#4ec9b0)

### 2. 实时搜索

在日志搜索框中输入关键词，实时过滤日志内容：

```
搜索示例：
- "TempMail" - 查找所有临时邮箱相关日志
- "密码" - 查找密码输入相关日志
- "error" - 查找所有错误日志
- "https://" - 查找所有包含 URL 的日志
```

搜索词会在日志中高亮显示（黄色背景）。

### 3. 自动滚动

默认启用自动滚动功能，新日志到达时自动滚动到底部。可以通过复选框关闭此功能，方便查看历史日志。

### 4. 日志清空

点击"清空日志"按钮可以清空当前显示的日志，方便重新开始查看。

### 5. 彩色日志开关

可以通过"彩色日志"复选框切换彩色显示和纯文本显示。

## 使用方法

### 启动配置界面

```bash
npm run config:ui
```

浏览器访问：http://127.0.0.1:3200

### 查看实时日志

1. 在配置界面中配置测试站点地址
2. 点击"开始测试"启动测试
3. 日志会自动显示在"实时日志"区域
4. 测试运行中，日志每 2 秒自动刷新

### 搜索日志

1. 在日志搜索框中输入关键词
2. 日志会实时过滤，只显示包含关键词的条目
3. 搜索词会在日志中高亮显示

### 导出日志

虽然界面没有直接的导出按钮，但可以通过以下方式导出日志：

1. 选中日志内容（Ctrl+A）
2. 复制（Ctrl+C）
3. 粘贴到文本编辑器中保存

## 日志格式

每条日志的格式如下：

```
[时间戳] [流类型] 日志内容
```

示例：
```
[2026-04-05 10:30:45] [stdout] [TempMail] Created temporary email: test@example.com
[2026-04-05 10:30:46] [stdout] [Flow] 输入邮箱后点击继续
[2026-04-05 10:30:47] [stdout] [UserInfo] Generated user info: John Smith
```

## 日志级别

日志查看器自动识别以下日志级别：

- **SUCCESS** - 包含 ✓ 或"成功"的日志
- **ERROR** - 包含 ✗ 或"失败"或"error"的日志
- **WARNING** - 包含"警告"或"warning"的日志
- **DEBUG** - 包含 [DEBUG] 标签的日志
- **INFO** - 其他所有日志

## 高级功能

### 日志标签识别

日志查看器自动识别方括号中的标签，并应用相应的颜色：

```
[TempMail] - 临时邮箱相关操作
[Flow] - 测试流程步骤
[UserInfo] - 用户信息生成
[Expert] - 专家级绕过方案
[TopTier] - 顶级反检测方案
[STAGE] - 流程阶段标记
```

### URL 自动高亮

日志中的 URL 会自动高亮显示为蓝色，方便识别。

### 数字高亮

日志中的数字会自动高亮显示为浅绿色。

## 性能优化

- 日志最多保留最近 400 条，避免内存占用过大
- 搜索和过滤在客户端进行，不会增加服务器负担
- 日志渲染使用 innerHTML，支持 HTML 标签和样式

## 故障排除

### 日志不更新

1. 检查测试是否正在运行
2. 点击"刷新状态"按钮手动刷新
3. 检查浏览器控制台是否有错误

### 搜索无结果

1. 检查搜索词是否正确
2. 尝试使用更短的关键词
3. 清空搜索框查看所有日志

### 日志显示异常

1. 尝试关闭彩色日志功能
2. 清空日志后重新加载
3. 刷新浏览器页面

## 技术实现

### 日志渲染流程

```javascript
1. 从服务器获取日志数组
2. 解析每条日志的标签和级别
3. 应用搜索过滤
4. 应用颜色高亮
5. 渲染到 <pre> 元素
6. 自动滚动到底部（如果启用）
```

### 日志解析

```javascript
function parseLogEntry(text) {
  const tagMatch = text.match(/\[([^\]]+)\]/);
  const tag = tagMatch ? tagMatch[1] : null;

  let level = 'info';
  if (text.includes('✓') || text.includes('成功')) level = 'success';
  else if (text.includes('✗') || text.includes('失败')) level = 'error';
  else if (text.includes('警告')) level = 'warning';

  return { tag, level, text };
}
```

### 颜色应用

```javascript
function colorizeLog(text, entry) {
  // 标签颜色
  if (entry.tag && logColors[entry.tag]) {
    text = text.replace(
      `[${entry.tag}]`,
      `<span style="color: ${logColors[entry.tag]};">[${entry.tag}]</span>`
    );
  }

  // 成功/错误标记
  // 数字高亮
  // URL 高亮

  return text;
}
```

## 未来改进

- [ ] 支持日志导出为文件
- [ ] 支持日志级别过滤
- [ ] 支持正则表达式搜索
- [ ] 支持日志时间范围过滤
- [ ] 支持日志统计和分析
- [ ] 支持 WebSocket 实时推送（避免轮询）

## 相关文件

- 配置界面：`src/config-ui/index.html`
- 配置服务器：`scripts/config-server.mjs`
- 测试文件：`tests/protection-validation.spec.ts`

## 参考资料

- [Playwright 测试报告](https://playwright.dev/docs/test-reporters)
- [HTML5 日志查看器最佳实践](https://developer.mozilla.org/en-US/docs/Web/HTML/Element/pre)
- [实时日志流设计模式](https://martinfowler.com/articles/patterns-of-distributed-systems/log-streaming.html)
