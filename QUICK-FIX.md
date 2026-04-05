# 快速修复：接口不存在错误

## 问题
```
接口不存在：/api/tempmail/config
```

## 解决方案（3 步）

### 第 1 步：停止服务器
在运行 `npm run config:ui` 的终端窗口：
- 按 `Ctrl+C` 停止服务器
- 等待进程完全退出

### 第 2 步：重新启动
```bash
npm run config:ui
```

### 第 3 步：刷新浏览器
- 按 `Ctrl+Shift+R`（硬刷新）
- 或者按 `F5` 刷新页面

## 验证修复

重新填写配置并点击"保存临时邮箱配置"，应该看到：
```
✓ 临时邮箱配置已保存，测试时会自动创建临时邮箱。
```

## 仍然失败？

### 检查端口占用
```bash
# Windows
netstat -ano | findstr :3200

# 如果有进程占用，记下 PID，然后：
taskkill /PID <进程ID> /F

# 重新启动
npm run config:ui
```

### 使用其他端口
```bash
CONFIG_UI_PORT=3201 npm run config:ui
```

然后访问：http://127.0.0.1:3201

---

**90% 的情况下，重启服务器就能解决问题！**
