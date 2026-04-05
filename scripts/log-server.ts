import { WebSocketServer } from 'ws';
import { spawn } from 'child_process';
import * as http from 'http';
import * as fs from 'fs';
import * as path from 'path';

/**
 * 实时日志服务器
 * 运行 Playwright 测试并通过 WebSocket 实时传输日志
 */

const PORT = 3100;
const LOG_VIEWER_PORT = 3101;

// 创建 HTTP 服务器用于提供日志查看器页面
const httpServer = http.createServer((req, res) => {
  if (req.url === '/' || req.url === '/index.html') {
    const htmlPath = path.join(__dirname, '../public/log-viewer.html');
    const html = fs.readFileSync(htmlPath, 'utf-8');
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(html);
  } else {
    res.writeHead(404);
    res.end('Not Found');
  }
});

// 创建 WebSocket 服务器
const wss = new WebSocketServer({ port: PORT });

console.log(`WebSocket 服务器运行在 ws://localhost:${PORT}`);
console.log(`日志查看器运行在 http://localhost:${LOG_VIEWER_PORT}`);

// 存储所有连接的客户端
const clients = new Set<any>();

wss.on('connection', (ws) => {
  console.log('客户端已连接');
  clients.add(ws);

  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message.toString());

      if (data.type === 'start') {
        console.log('收到启动测试请求');
        startTest(ws);
      } else if (data.type === 'stop') {
        console.log('收到停止测试请求');
        stopTest();
      }
    } catch (error) {
      console.error('解析消息失败:', error);
    }
  });

  ws.on('close', () => {
    console.log('客户端已断开');
    clients.delete(ws);
  });

  // 发送欢迎消息
  ws.send(JSON.stringify({
    type: 'log',
    level: 'info',
    message: '已连接到日志服务器',
    timestamp: new Date().toISOString()
  }));
});

let testProcess: any = null;

// 启动测试
function startTest(ws: any) {
  if (testProcess) {
    ws.send(JSON.stringify({
      type: 'log',
      level: 'warning',
      message: '测试已在运行中',
      timestamp: new Date().toISOString()
    }));
    return;
  }

  // 广播测试开始
  broadcast({
    type: 'status',
    status: 'running',
    message: '测试开始...',
    timestamp: new Date().toISOString()
  });

  // 启动 Playwright 测试
  const isWindows = process.platform === 'win32';
  const command = isWindows ? 'npx.cmd' : 'npx';

  testProcess = spawn(command, ['playwright', 'test'], {
    cwd: path.join(__dirname, '..'),
    env: { ...process.env, FORCE_COLOR: '0' },
    shell: isWindows
  });

  console.log('测试进程已启动...');

  // 捕获标准输出
  testProcess.stdout.on('data', (data: Buffer) => {
    const lines = data.toString().split('\n');
    lines.forEach(line => {
      if (line.trim()) {
        broadcast({
          type: 'log',
          level: parseLogLevel(line),
          message: line.trim(),
          timestamp: new Date().toISOString()
        });
      }
    });
  });

  // 捕获标准错误
  testProcess.stderr.on('data', (data: Buffer) => {
    const lines = data.toString().split('\n');
    lines.forEach(line => {
      if (line.trim()) {
        broadcast({
          type: 'log',
          level: 'error',
          message: line.trim(),
          timestamp: new Date().toISOString()
        });
      }
    });
  });

  // 测试完成
  testProcess.on('close', (code: number) => {
    const status = code === 0 ? 'success' : 'error';
    const message = code === 0 ? '测试完成' : `测试失败 (退出码: ${code})`;

    broadcast({
      type: 'status',
      status,
      message,
      timestamp: new Date().toISOString()
    });

    testProcess = null;
  });

  // 错误处理
  testProcess.on('error', (error: Error) => {
    broadcast({
      type: 'log',
      level: 'error',
      message: `进程错误: ${error.message}`,
      timestamp: new Date().toISOString()
    });

    testProcess = null;
  });
}

// 停止测试
function stopTest() {
  if (testProcess) {
    testProcess.kill();
    testProcess = null;

    broadcast({
      type: 'status',
      status: 'stopped',
      message: '测试已停止',
      timestamp: new Date().toISOString()
    });
  }
}

// 广播消息到所有客户端
function broadcast(message: any) {
  const data = JSON.stringify(message);
  clients.forEach(client => {
    if (client.readyState === 1) { // OPEN
      client.send(data);
    }
  });
}

// 解析日志级别
function parseLogLevel(message: string): string {
  if (message.includes('✓') || message.includes('成功') || message.includes('passed')) {
    return 'success';
  }
  if (message.includes('✗') || message.includes('失败') || message.includes('failed') || message.includes('error')) {
    return 'error';
  }
  if (message.includes('警告') || message.includes('warning')) {
    return 'warning';
  }
  if (message.includes('[DEBUG]')) {
    return 'debug';
  }
  return 'info';
}

// 启动 HTTP 服务器
httpServer.listen(LOG_VIEWER_PORT, () => {
  console.log('');
  console.log('========================================');
  console.log('实时日志服务器已启动');
  console.log('========================================');
  console.log('');
  console.log(`📊 日志查看器: http://localhost:${LOG_VIEWER_PORT}`);
  console.log(`🔌 WebSocket 端点: ws://localhost:${PORT}`);
  console.log('');
  console.log('在浏览器中打开日志查看器，然后点击"开始测试"按钮');
  console.log('');
});

// 优雅关闭
process.on('SIGINT', () => {
  console.log('\n正在关闭服务器...');

  if (testProcess) {
    testProcess.kill();
  }

  wss.close(() => {
    console.log('WebSocket 服务器已关闭');
  });

  httpServer.close(() => {
    console.log('HTTP 服务器已关闭');
    process.exit(0);
  });
});
