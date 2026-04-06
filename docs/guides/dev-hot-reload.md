# 前端热重载开发指南

本指南说明如何在开发模式下实现前端代码修改后自动刷新，无需重启服务。

## 快速开始

### 一键启动开发环境

```bash
npm run dev
```

这个命令会同时启动：
- **后端 API 服务**（端口 3200）- 提供数据接口
- **前端开发服务**（端口 5173）- 支持热重载

### 访问地址

开发模式下访问：
```
http://127.0.0.1:5173
```

生产模式下访问：
```
http://127.0.0.1:3200
```

## 工作原理

### 开发模式架构

```
┌─────────────────┐
│   浏览器        │
│  localhost:5173 │
└────────┬────────┘
         │
         ↓
┌─────────────────┐      API 请求代理
│  Vite Dev Server│ ─────────────────→ ┌──────────────────┐
│  (前端热重载)    │                    │  config-server   │
│  端口: 5173     │ ←───────────────── │  (后端 API)      │
└─────────────────┘      API 响应       │  端口: 3200      │
                                        └──────────────────┘
```

### Vite 热重载特性

Vite 提供以下热重载能力：

1. **即时模块替换（HMR）**
   - 修改 `.tsx`、`.ts`、`.css` 文件后立即生效
   - 保持组件状态，无需刷新整个页面

2. **快速冷启动**
   - 使用 ESM 原生模块，启动速度极快

3. **按需编译**
   - 只编译当前访问的模块

## 开发工作流

### 1. 启动开发环境

```bash
npm run dev
```

你会看到类似输出：
```
🚀 启动开发环境...

[API] 平台控制台服务已启动: http://127.0.0.1:3200
[Vite] VITE v7.1.10  ready in 523 ms
[Vite] ➜  Local:   http://127.0.0.1:5173/
```

### 2. 修改前端代码

编辑任何前端文件：
- `frontend/src/**/*.tsx` - React 组件
- `frontend/src/**/*.ts` - TypeScript 模块
- `frontend/src/**/*.css` - 样式文件

保存后，浏览器会**自动更新**，无需手动刷新。

### 3. 查看效果

- 打开浏览器访问 `http://127.0.0.1:5173`
- 修改代码并保存
- 浏览器自动更新显示最新效果

### 4. 停止服务

按 `Ctrl+C` 停止所有服务。

## 单独启动服务

如果需要单独启动某个服务：

### 只启动后端 API

```bash
npm run config:ui
```

访问：`http://127.0.0.1:3200`（需要先构建前端）

### 只启动前端开发服务

```bash
npm run console:dev
```

访问：`http://127.0.0.1:5173`（需要后端 API 运行在 3200 端口）

## 生产构建

### 构建前端

```bash
npm run console:build
```

构建产物输出到 `dist/platform-console/`

### 启动生产服务

```bash
npm run config:ui
```

访问：`http://127.0.0.1:3200`

## API 代理配置

开发模式下，Vite 会自动代理 API 请求到后端服务：

```typescript
// frontend/vite.config.ts
server: {
  port: 5173,
  proxy: {
    "/api": "http://127.0.0.1:3200",
    "/report": "http://127.0.0.1:3200",
    "/playwright-report": "http://127.0.0.1:3200",
    "/platform-files": "http://127.0.0.1:3200"
  }
}
```

这意味着：
- 前端请求 `/api/platform/tasks` 
- 实际访问 `http://127.0.0.1:3200/api/platform/tasks`

## 常见问题

### 1. 端口被占用

如果 5173 或 3200 端口被占用：

**查看占用进程：**
```bash
# Windows
netstat -ano | findstr :5173
netstat -ano | findstr :3200

# Linux/Mac
lsof -i :5173
lsof -i :3200
```

**修改端口：**
编辑 `frontend/vite.config.ts`：
```typescript
server: {
  port: 5174,  // 改为其他端口
  // ...
}
```

### 2. 热重载不生效

**可能原因：**
- 文件保存失败
- 浏览器缓存
- Vite 进程异常

**解决方法：**
1. 确认文件已保存
2. 硬刷新浏览器（Ctrl+Shift+R）
3. 重启开发服务

### 3. API 请求失败

**检查后端服务：**
```bash
curl http://127.0.0.1:3200/health
```

应该返回：
```json
{"ok":true}
```

如果失败，确保后端服务正在运行。

### 4. 修改后端代码需要重启

后端代码（`scripts/*.mjs`、`src/**/*.ts`）修改后，需要重启服务：

1. 按 `Ctrl+C` 停止
2. 重新运行 `npm run dev`

## 开发技巧

### 1. 使用浏览器开发工具

- **React DevTools** - 查看组件树和状态
- **Network 面板** - 监控 API 请求
- **Console 面板** - 查看日志和错误

### 2. TypeScript 类型检查

在开发过程中运行类型检查：
```bash
npm run console:typecheck
```

### 3. 保持状态的热重载

Vite 的 HMR 会尽量保持组件状态：
- 修改组件渲染逻辑 → 保持状态
- 修改组件状态定义 → 重置状态

### 4. 快速定位问题

如果页面出现错误：
1. 查看浏览器控制台
2. 查看终端输出
3. 检查网络请求

## 性能优化

### 开发模式性能

Vite 开发模式已经很快，但可以进一步优化：

1. **减少不必要的依赖**
2. **使用代码分割**
3. **避免大文件导入**

### 生产构建优化

```bash
# 构建并分析包大小
npm run console:build
```

查看 `dist/platform-console/` 目录了解构建产物。

## 相关文档

- [Vite 官方文档](https://vitejs.dev/)
- [React 热重载原理](https://github.com/vitejs/vite-plugin-react/tree/main/packages/plugin-react)
- [项目架构说明](../ARCHITECTURE.md)

---

**最后更新**: 2026-04-06
