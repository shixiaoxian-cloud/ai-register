import { spawn } from "node:child_process";
import { createReadStream, existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

import dotenv from "dotenv";

dotenv.config({ quiet: true });

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");
const configPath = path.join(projectRoot, "config", "target-site.json");
const tempMailConfigPath = path.join(projectRoot, "config", "temp-mail.json");
const pagePath = path.join(projectRoot, "src", "config-ui", "index.html");
const reportDirPath = path.join(projectRoot, "playwright-report");
const reportIndexPath = path.join(reportDirPath, "index.html");
const maxLogEntries = 400;

function jsonResponse(response, statusCode, payload) {
  response.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store"
  });
  response.end(JSON.stringify(payload));
}

function textResponse(response, statusCode, body, contentType = "text/plain; charset=utf-8") {
  response.writeHead(statusCode, {
    "Content-Type": contentType,
    "Cache-Control": "no-store"
  });
  response.end(body);
}

function validateHttpsUrl(input) {
  let parsed;

  try {
    parsed = new URL(String(input ?? "").trim());
  } catch {
    throw new Error("请输入完整且有效的地址，例如 https://example.com/register");
  }

  if (parsed.protocol !== "https:") {
    throw new Error("当前仅接受 https:// 地址。");
  }

  if (!parsed.hostname) {
    throw new Error("地址中缺少有效域名。");
  }

  return parsed.toString();
}

function getContentType(filePath) {
  const extension = path.extname(filePath).toLowerCase();

  switch (extension) {
    case ".html":
      return "text/html; charset=utf-8";
    case ".css":
      return "text/css; charset=utf-8";
    case ".js":
      return "application/javascript; charset=utf-8";
    case ".json":
      return "application/json; charset=utf-8";
    case ".svg":
      return "image/svg+xml";
    case ".png":
      return "image/png";
    case ".jpg":
    case ".jpeg":
      return "image/jpeg";
    case ".webm":
      return "video/webm";
    case ".zip":
      return "application/zip";
    case ".ttf":
      return "font/ttf";
    case ".woff":
      return "font/woff";
    case ".woff2":
      return "font/woff2";
    case ".md":
      return "text/markdown; charset=utf-8";
    case ".webmanifest":
      return "application/manifest+json; charset=utf-8";
    default:
      return "application/octet-stream";
  }
}

function createInitialRunState() {
  return {
    status: "idle",
    mode: "headless",
    pid: null,
    runId: 0,
    command: "",
    startedAt: "",
    finishedAt: "",
    exitCode: null,
    reportAvailable: existsSync(reportIndexPath),
    logs: [],
    summary: "尚未执行测试。"
  };
}

let runState = createInitialRunState();
let currentChild = null;

function detectLatestStage(logs) {
  if (!Array.isArray(logs)) {
    return null;
  }

  for (let index = logs.length - 1; index >= 0; index -= 1) {
    const text = logs[index]?.text ?? "";
    const match = text.match(/^\[STAGE\]\s(.+?)\s\|\s(.+?)\s\|\s(.*?)\s\|\s(.+)$/);

    if (match) {
      return {
        stageLabel: match[1],
        outcomeKind: match[2],
        url: match[3],
        details: match[4]
      };
    }
  }

  return null;
}

function detectRunInsight(run) {
  const combined = [
    run.summary ?? "",
    ...(Array.isArray(run.logs) ? run.logs.map((entry) => entry.text) : [])
  ].join("\n");

  if (
    /登录前安全检查页|请稍候|checking your browser|verify you are human|站点在登录前展示了安全检查页/i.test(
      combined
    )
  ) {
    return {
      type: "pre_auth_challenge",
      title: "登录前先触发了安全检查",
      message:
        "页面当前停留在“请稍候…”或同类验证页，登录按钮还没有真正渲染出来，所以脚本并不是没点，而是暂时没有可点的目标。",
      action:
        run.status === "running" || run.status === "stopping"
          ? "如果你已经开启 CONTINUE_AFTER_PROTECTED_CHALLENGE=true，请先在浏览器完成验证，再回到启动 config:ui 的终端按回车继续。"
          : "可以先手动完成挑战后再重试，或者在 .env 中开启 CONTINUE_AFTER_PROTECTED_CHALLENGE=true，让脚本等待你人工通过挑战。"
    };
  }

  return null;
}

function detectRunConclusion(run, latestStage, insight) {
  if (latestStage) {
    const stageText = latestStage.stageLabel;
    const detailText = latestStage.details || "未提供额外细节。";

    switch (latestStage.outcomeKind) {
      case "pre_auth_challenge":
        return {
          tone: "alert",
          title: `风控在${stageText}触发`,
          summary: "站点在登录按钮渲染前就进入了安全检查页。",
          detail: detailText,
          action:
            run.status === "running" || run.status === "stopping"
              ? "如果已开启 CONTINUE_AFTER_PROTECTED_CHALLENGE=true，请先完成浏览器里的挑战，再回到终端按回车继续。"
              : "可以手动通过挑战后再重试，或开启 CONTINUE_AFTER_PROTECTED_CHALLENGE=true 让脚本等待人工续跑。"
        };
      case "captcha":
        return {
          tone: "alert",
          title: `风控在${stageText}触发`,
          summary: "流程进入了 CAPTCHA 人机校验阶段。",
          detail: detailText,
          action: "这通常说明该阶段的保护已生效。若要继续验证后续流程，可人工完成挑战后续跑。"
        };
      case "sms_challenge":
        return {
          tone: "alert",
          title: `风控在${stageText}触发`,
          summary: "流程进入了短信验证码挑战。",
          detail: detailText,
          action: "这通常说明该阶段已触发二次验证。可结合测试账号和人工续跑评估后续行为。"
        };
      case "device_challenge":
        return {
          tone: "alert",
          title: `风控在${stageText}触发`,
          summary: "流程进入了设备或安全校验挑战。",
          detail: detailText,
          action: "这通常说明设备风险控制已介入。建议记录截图、trace 和触发时机。"
        };
      case "blocked":
        return {
          tone: "alert",
          title: `流程在${stageText}被阻断`,
          summary: "站点已经展示阻断页或风险拦截提示。",
          detail: detailText,
          action: "这通常表示拦截已经生效。可以把当前截图、阶段和 URL 作为验证证据。"
        };
      case "success":
        return {
          tone: "success",
          title: `流程在${stageText}后继续通过`,
          summary: "当前链路没有被阻断，已经进入成功态。",
          detail: detailText,
          action: "如果目标是验证风控有效性，可以换场景、账号或运行模式继续比对。"
        };
      case "email_code_requested":
        return {
          tone: "neutral",
          title: `流程推进到${stageText}`,
          summary: "当前进入邮箱验证码环节，属于业务校验步骤。",
          detail: detailText,
          action: "这还不属于阻断性风控结果，如需继续判断，请完成邮箱验证码链路。"
        };
      case "unknown":
        return {
          tone: "neutral",
          title: `流程在${stageText}后结果未明`,
          summary: "脚本已经推进到该阶段，但暂时没有识别出明确结果。",
          detail: detailText,
          action: "建议结合实时日志、截图和 trace 继续排查页面实际状态。"
        };
      default:
        break;
    }
  }

  if (insight?.type === "pre_auth_challenge") {
    return {
      tone: "alert",
      title: "风控在登录前触发",
      summary: "页面先进入了安全检查页，因此登录按钮没有真正出现。",
      detail: insight.message,
      action: insight.action
    };
  }

  if (run.status === "passed") {
    return {
      tone: "success",
      title: "本次流程执行完成",
      summary: "测试运行已结束，且当前没有记录到阻断性结果。",
      detail: run.summary ?? "未提供额外细节。",
      action: "可以打开测试报告，结合视频、截图和 trace 查看完整链路。"
    };
  }

  return null;
}

function appendLog(stream, chunk) {
  const text = Buffer.isBuffer(chunk) ? chunk.toString("utf8") : String(chunk);
  const normalized = text.replace(/\r\n/g, "\n");

  for (const segment of normalized.split("\n")) {
    if (!segment.trim()) {
      continue;
    }

    runState.logs.push({
      at: new Date().toISOString(),
      stream,
      text: segment
    });
  }

  if (runState.logs.length > maxLogEntries) {
    runState.logs = runState.logs.slice(runState.logs.length - maxLogEntries);
  }
}

function getRunSnapshot() {
  const snapshot = {
    ...runState,
    reportAvailable: existsSync(reportIndexPath)
  };
  const latestStage = detectLatestStage(snapshot.logs);
  const insight = detectRunInsight(snapshot);

  return {
    ...snapshot,
    latestStage,
    insight,
    conclusion: detectRunConclusion(snapshot, latestStage, insight)
  };
}

async function ensureConfigDirectory() {
  await mkdir(path.dirname(configPath), { recursive: true });
}

async function readConfig() {
  if (!existsSync(configPath)) {
    return {
      startUrl: "",
      updatedAt: "",
      tempMailBaseUrl: "",
      tempMailApiKey: ""
    };
  }

  const rawText = await readFile(configPath, "utf8");
  const parsed = JSON.parse(rawText);

  // 尝试读取临时邮箱配置
  let tempMailConfig = { baseUrl: "", apiKey: "" };
  if (existsSync(tempMailConfigPath)) {
    try {
      const tempMailText = await readFile(tempMailConfigPath, "utf8");
      const tempMailParsed = JSON.parse(tempMailText);
      tempMailConfig = {
        baseUrl: typeof tempMailParsed.baseUrl === "string" ? tempMailParsed.baseUrl : "",
        apiKey: typeof tempMailParsed.apiKey === "string" ? tempMailParsed.apiKey : ""
      };
    } catch {
      // 忽略读取错误
    }
  }

  return {
    startUrl: typeof parsed.startUrl === "string" ? parsed.startUrl : "",
    updatedAt: typeof parsed.updatedAt === "string" ? parsed.updatedAt : "",
    tempMailBaseUrl: tempMailConfig.baseUrl,
    tempMailApiKey: tempMailConfig.apiKey
  };
}

async function writeConfig(startUrl) {
  await ensureConfigDirectory();
  const payload = {
    startUrl,
    updatedAt: new Date().toISOString()
  };

  await writeFile(configPath, JSON.stringify(payload, null, 2), "utf8");
  return payload;
}

async function writeTempMailConfig(baseUrl, apiKey) {
  await ensureConfigDirectory();
  const payload = {
    baseUrl,
    apiKey,
    updatedAt: new Date().toISOString()
  };

  await writeFile(tempMailConfigPath, JSON.stringify(payload, null, 2), "utf8");

  // 同时更新 .env 文件
  const envPath = path.join(projectRoot, ".env");
  let envContent = "";

  if (existsSync(envPath)) {
    envContent = await readFile(envPath, "utf8");
  }

  // 更新或添加配置
  const lines = envContent.split("\n");
  const updates = {
    USE_TEMP_MAIL: "true",
    TEMP_MAIL_BASE_URL: baseUrl,
    TEMP_MAIL_API_KEY: apiKey
  };

  for (const [key, value] of Object.entries(updates)) {
    const regex = new RegExp(`^${key}=.*$`, "m");
    if (regex.test(envContent)) {
      envContent = envContent.replace(regex, `${key}=${value}`);
    } else {
      envContent += `\n${key}=${value}`;
    }
  }

  await writeFile(envPath, envContent.trim() + "\n", "utf8");

  return payload;
}

async function testTempMailConnection(baseUrl, apiKey) {
  try {
    // 动态导入 node-fetch
    const fetch = (await import("node-fetch")).default;

    // 创建临时邮箱
    const createResponse = await fetch(`${baseUrl}/api/mailboxes`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({})
    });

    if (!createResponse.ok) {
      throw new Error(`API 返回错误: ${createResponse.status} ${createResponse.statusText}`);
    }

    const createData = await createResponse.json();
    const mailboxId = createData.mailbox?.id;
    const mailboxAddress = createData.mailbox?.full_address;

    if (!mailboxId || !mailboxAddress) {
      throw new Error("API 返回数据格式不正确");
    }

    // 删除临时邮箱
    await fetch(`${baseUrl}/api/mailboxes/${mailboxId}`, {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${apiKey}`
      }
    });

    return {
      success: true,
      testEmail: mailboxAddress
    };
  } catch (error) {
    throw new Error(
      error instanceof Error
        ? `连接失败: ${error.message}`
        : "连接测试失败"
    );
  }
}

async function readBody(request) {
  const chunks = [];

  for await (const chunk of request) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  return Buffer.concat(chunks).toString("utf8");
}

function serveStaticFile(response, filePath) {
  if (!existsSync(filePath)) {
    textResponse(response, 404, "Not Found");
    return;
  }

  response.writeHead(200, {
    "Content-Type": getContentType(filePath),
    "Cache-Control": "no-store"
  });

  createReadStream(filePath).pipe(response);
}

async function startTestRun(mode) {
  if (currentChild) {
    throw new Error("当前已有测试任务正在运行，请等待结束或先停止它。");
  }

  const config = await readConfig();
  validateHttpsUrl(config.startUrl);

  const resolvedMode = mode === "headed" ? "headed" : "headless";
  const isWindows = process.platform === "win32";
  const scriptName = resolvedMode === "headed" ? "test:headed" : "test";
  const command = isWindows ? process.env.ComSpec || "cmd.exe" : "npm";
  const args = isWindows
    ? ["/d", "/s", "/c", `npm run ${scriptName}`]
    : ["run", scriptName];

  runState = {
    status: "running",
    mode: resolvedMode,
    pid: null,
    runId: runState.runId + 1,
    command: isWindows ? `npm run ${scriptName}` : `${command} ${args.join(" ")}`,
    startedAt: new Date().toISOString(),
    finishedAt: "",
    exitCode: null,
    reportAvailable: existsSync(reportIndexPath),
    logs: [],
    summary:
      resolvedMode === "headed"
        ? "已启动可视化浏览器测试。"
        : "已启动无头模式测试。"
  };

  appendLog("system", `任务已创建，模式：${resolvedMode}`);
  appendLog("system", `执行命令：${runState.command}`);

  currentChild = spawn(command, args, {
    cwd: projectRoot,
    env: {
      ...process.env,
      FORCE_COLOR: "1"
    },
    stdio: ["ignore", "pipe", "pipe"]
  });

  runState.pid = currentChild.pid ?? null;

  currentChild.stdout?.on("data", (chunk) => {
    appendLog("stdout", chunk);
  });

  currentChild.stderr?.on("data", (chunk) => {
    appendLog("stderr", chunk);
  });

  currentChild.on("error", (error) => {
    appendLog("stderr", `启动测试失败：${error.message}`);
    runState.status = "failed";
    runState.finishedAt = new Date().toISOString();
    runState.exitCode = -1;
    runState.summary = `测试进程启动失败：${error.message}`;
    currentChild = null;
  });

  currentChild.on("close", (code, signal) => {
    const finalStatus =
      runState.status === "stopping"
        ? "stopped"
        : code === 0
          ? "passed"
          : "failed";

    runState.status = finalStatus;
    runState.finishedAt = new Date().toISOString();
    runState.exitCode = code ?? null;
    runState.reportAvailable = existsSync(reportIndexPath);

    if (signal) {
      appendLog("system", `测试进程已结束，信号：${signal}`);
    } else {
      appendLog("system", `测试进程已结束，退出码：${code}`);
    }

    if (finalStatus === "passed") {
      runState.summary = "测试执行完成，结果为通过。";
    } else if (finalStatus === "stopped") {
      runState.summary = "测试任务已由前端手动停止。";
    } else {
      runState.summary = "测试执行结束，但存在失败或异常。";
    }

    const insight = detectRunInsight(runState);
    if (finalStatus === "failed" && insight?.type === "pre_auth_challenge") {
      runState.summary = insight.title;
    }

    currentChild = null;
  });

  return getRunSnapshot();
}

function stopTestRun() {
  if (!currentChild) {
    throw new Error("当前没有正在运行的测试任务。");
  }

  runState.status = "stopping";
  runState.summary = "正在请求停止测试任务...";
  appendLog("system", "收到停止请求，正在尝试终止测试进程。");

  if (process.platform === "win32" && runState.pid) {
    const killer = spawn("taskkill", ["/pid", String(runState.pid), "/t", "/f"], {
      stdio: ["ignore", "pipe", "pipe"]
    });

    killer.stdout?.on("data", (chunk) => appendLog("system", chunk));
    killer.stderr?.on("data", (chunk) => appendLog("stderr", chunk));
  } else {
    currentChild.kill();
  }

  return getRunSnapshot();
}

export function createConfigServer() {
  return createServer(async (request, response) => {
    const method = request.method ?? "GET";
    const requestUrl = new URL(request.url ?? "/", "http://127.0.0.1");

    if (method === "GET" && requestUrl.pathname === "/") {
      const html = await readFile(pagePath, "utf8");
      textResponse(response, 200, html, "text/html; charset=utf-8");
      return;
    }

    if (method === "GET" && requestUrl.pathname === "/api/config") {
      const config = await readConfig();
      jsonResponse(response, 200, { ok: true, config });
      return;
    }

    if (method === "POST" && requestUrl.pathname === "/api/config") {
      try {
        const bodyText = await readBody(request);
        const parsed = JSON.parse(bodyText || "{}");
        const startUrl = validateHttpsUrl(parsed.startUrl);
        const config = await writeConfig(startUrl);

        jsonResponse(response, 200, {
          ok: true,
          message: "测试站点地址已保存。",
          config
        });
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "保存配置时发生未知错误。";

        jsonResponse(response, 400, {
          ok: false,
          message
        });
      }

      return;
    }

    if (method === "GET" && requestUrl.pathname === "/api/run") {
      jsonResponse(response, 200, { ok: true, run: getRunSnapshot() });
      return;
    }

    if (method === "POST" && requestUrl.pathname === "/api/run") {
      try {
        const bodyText = await readBody(request);
        const parsed = JSON.parse(bodyText || "{}");
        const run = await startTestRun(parsed.mode);

        jsonResponse(response, 200, {
          ok: true,
          message: "测试任务已启动。",
          run
        });
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "启动测试时发生未知错误。";

        jsonResponse(response, 400, {
          ok: false,
          message,
          run: getRunSnapshot()
        });
      }

      return;
    }

    if (method === "POST" && requestUrl.pathname === "/api/run/stop") {
      try {
        const run = stopTestRun();
        jsonResponse(response, 200, {
          ok: true,
          message: "已发送停止指令。",
          run
        });
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "停止测试时发生未知错误。";

        jsonResponse(response, 400, {
          ok: false,
          message,
          run: getRunSnapshot()
        });
      }

      return;
    }

    if (method === "GET" && requestUrl.pathname === "/report") {
      if (!existsSync(reportIndexPath)) {
        textResponse(response, 404, "测试报告尚未生成。");
        return;
      }

      response.writeHead(302, {
        Location: "/playwright-report/index.html",
        "Cache-Control": "no-store"
      });
      response.end();
      return;
    }

    if (method === "GET" && requestUrl.pathname.startsWith("/playwright-report/")) {
      const relativePath = decodeURIComponent(
        requestUrl.pathname.replace("/playwright-report/", "")
      );
      const normalizedPath = path.normalize(relativePath);
      const absolutePath = path.resolve(reportDirPath, normalizedPath);

      if (!absolutePath.startsWith(reportDirPath)) {
        textResponse(response, 403, "Forbidden");
        return;
      }

      serveStaticFile(response, absolutePath);
      return;
    }

    if (method === "GET" && requestUrl.pathname === "/health") {
      jsonResponse(response, 200, { ok: true });
      return;
    }

    if (method === "POST" && requestUrl.pathname === "/api/tempmail/config") {
      try {
        const bodyText = await readBody(request);
        const parsed = JSON.parse(bodyText || "{}");
        const baseUrl = String(parsed.baseUrl || "").trim();
        const apiKey = String(parsed.apiKey || "").trim();

        if (!baseUrl || !apiKey) {
          throw new Error("请提供完整的临时邮箱配置（baseUrl 和 apiKey）");
        }

        await writeTempMailConfig(baseUrl, apiKey);

        jsonResponse(response, 200, {
          ok: true,
          message: "临时邮箱配置已保存。"
        });
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "保存临时邮箱配置时发生未知错误。";

        jsonResponse(response, 400, {
          ok: false,
          message
        });
      }

      return;
    }

    if (method === "POST" && requestUrl.pathname === "/api/tempmail/test") {
      try {
        const bodyText = await readBody(request);
        const parsed = JSON.parse(bodyText || "{}");
        const baseUrl = String(parsed.baseUrl || "").trim();
        const apiKey = String(parsed.apiKey || "").trim();

        if (!baseUrl || !apiKey) {
          throw new Error("请提供完整的临时邮箱配置（baseUrl 和 apiKey）");
        }

        const result = await testTempMailConnection(baseUrl, apiKey);

        jsonResponse(response, 200, {
          ok: true,
          message: "连接测试成功。",
          testEmail: result.testEmail
        });
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "测试连接时发生未知错误。";

        jsonResponse(response, 400, {
          ok: false,
          message
        });
      }

      return;
    }

    if (requestUrl.pathname.startsWith("/api/")) {
      jsonResponse(response, 404, {
        ok: false,
        message: `接口不存在：${requestUrl.pathname}`
      });
      return;
    }

    textResponse(response, 404, "Not Found");
  });
}

const isEntrypoint =
  process.argv[1] &&
  path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));

if (isEntrypoint) {
  const port = Number(process.env.CONFIG_UI_PORT ?? 3200);
  const server = createConfigServer();

  server.listen(port, "127.0.0.1", () => {
    console.log(`配置界面已启动: http://127.0.0.1:${port}`);
    console.log("请在浏览器中打开该地址，配置站点并直接发起测试。");
  });
}
