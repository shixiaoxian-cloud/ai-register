#!/usr/bin/env node

import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");

const processes = [];

function startProcess(name, command, args, color) {
  const proc = spawn(command, args, {
    cwd: projectRoot,
    shell: true,
    stdio: "pipe"
  });

  proc.stdout.on("data", (data) => {
    process.stdout.write(`\x1b[${color}m[${name}]\x1b[0m ${data}`);
  });

  proc.stderr.on("data", (data) => {
    process.stderr.write(`\x1b[${color}m[${name}]\x1b[0m ${data}`);
  });

  proc.on("close", (code) => {
    console.log(`\x1b[${color}m[${name}]\x1b[0m 进程退出，代码: ${code}`);
  });

  processes.push(proc);
  return proc;
}

console.log("\x1b[36m🚀 启动开发环境...\x1b[0m\n");

// 启动后端 API 服务
startProcess("API", "node", ["./scripts/config-server.mjs"], "33");

// 等待 1 秒后启动前端开发服务
setTimeout(() => {
  startProcess("Vite", "npm", ["run", "console:dev"], "32");
}, 1000);

// 优雅退出
process.on("SIGINT", () => {
  console.log("\n\x1b[36m🛑 正在关闭所有服务...\x1b[0m");
  processes.forEach((proc) => proc.kill());
  process.exit(0);
});

process.on("SIGTERM", () => {
  processes.forEach((proc) => proc.kill());
  process.exit(0);
});
