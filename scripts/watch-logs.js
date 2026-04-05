#!/usr/bin/env node

/**
 * 简化版实时日志查看器
 * 直接在命令行显示彩色日志
 */

const { spawn } = require('child_process');
const path = require('path');

// ANSI 颜色代码
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',

  // 前景色
  black: '\x1b[30m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',

  // 背景色
  bgRed: '\x1b[41m',
  bgGreen: '\x1b[42m',
  bgYellow: '\x1b[43m',
  bgBlue: '\x1b[44m'
};

function log(message, color = 'white') {
  const timestamp = new Date().toLocaleTimeString('zh-CN', { hour12: false });
  console.log(`${colors.dim}[${timestamp}]${colors.reset} ${colors[color]}${message}${colors.reset}`);
}

function parseLogLevel(message) {
  if (message.includes('✓') || message.includes('成功') || message.includes('passed')) {
    return 'green';
  }
  if (message.includes('✗') || message.includes('失败') || message.includes('failed') || message.includes('error')) {
    return 'red';
  }
  if (message.includes('警告') || message.includes('warning')) {
    return 'yellow';
  }
  if (message.includes('[TempMail]') || message.includes('[Flow]')) {
    return 'cyan';
  }
  return 'white';
}

console.log('');
console.log(`${colors.bright}${colors.blue}========================================${colors.reset}`);
console.log(`${colors.bright}${colors.blue}实时日志查看器${colors.reset}`);
console.log(`${colors.bright}${colors.blue}========================================${colors.reset}`);
console.log('');

log('正在启动 Playwright 测试...', 'cyan');
console.log('');

// 启动测试
const isWindows = process.platform === 'win32';
const command = isWindows ? 'npx.cmd' : 'npx';

const testProcess = spawn(command, ['playwright', 'test'], {
  cwd: path.join(__dirname, '..'),
  shell: isWindows,
  env: { ...process.env }
});

let hasOutput = false;

// 捕获标准输出
testProcess.stdout.on('data', (data) => {
  hasOutput = true;
  const lines = data.toString().split('\n');
  lines.forEach(line => {
    if (line.trim()) {
      const color = parseLogLevel(line);
      log(line.trim(), color);
    }
  });
});

// 捕获标准错误
testProcess.stderr.on('data', (data) => {
  hasOutput = true;
  const lines = data.toString().split('\n');
  lines.forEach(line => {
    if (line.trim()) {
      log(line.trim(), 'red');
    }
  });
});

// 测试完成
testProcess.on('close', (code) => {
  console.log('');
  if (code === 0) {
    log('✓ 测试完成', 'green');
  } else {
    log(`✗ 测试失败 (退出码: ${code})`, 'red');
  }
  console.log('');
  console.log(`${colors.bright}${colors.blue}========================================${colors.reset}`);
  console.log('');
});

// 错误处理
testProcess.on('error', (error) => {
  console.log('');
  log(`✗ 进程错误: ${error.message}`, 'red');
  console.log('');

  if (error.message.includes('ENOENT')) {
    log('提示: 请确保已安装 Playwright', 'yellow');
    log('运行: npm install', 'yellow');
  }
});

// 超时检测
setTimeout(() => {
  if (!hasOutput) {
    console.log('');
    log('⚠ 警告: 10秒内没有日志输出', 'yellow');
    log('可能的原因:', 'yellow');
    log('  1. 测试正在初始化（请继续等待）', 'white');
    log('  2. Playwright 未安装（运行: npm run pw:install）', 'white');
    log('  3. 浏览器未安装（运行: npm run pw:install）', 'white');
    console.log('');
  }
}, 10000);

// Ctrl+C 处理
process.on('SIGINT', () => {
  console.log('');
  log('正在停止测试...', 'yellow');
  testProcess.kill();
  setTimeout(() => {
    process.exit(0);
  }, 1000);
});
