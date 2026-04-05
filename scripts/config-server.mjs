import { createReadStream, existsSync } from "node:fs";
import { stat } from "node:fs/promises";
import { createServer } from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

import dotenv from "dotenv";
import { createRunController } from "./platform-runner.mjs";
import { createPlatformStore } from "./platform-store.mjs";

dotenv.config({ quiet: true });

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");
const consoleDistPath = path.join(projectRoot, "dist", "platform-console");
const reportDirPath = path.join(projectRoot, "playwright-report");
const reportIndexPath = path.join(reportDirPath, "index.html");

const store = createPlatformStore(projectRoot);
const runner = createRunController({
  projectRoot,
  reportIndexPath,
  activatePlan: store.activatePlan,
  listStoredRuns: store.listRuns,
  getStoredRunById: store.getRunById,
  saveStoredRun: store.saveRun,
  listStoredArtifacts: store.listArtifacts,
  archiveArtifactsForRun: store.archiveArtifactsForRun
});

function jsonResponse(response, statusCode, payload) {
  response.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store"
  });
  response.end(JSON.stringify(payload));
}

function textResponse(
  response,
  statusCode,
  body,
  contentType = "text/plain; charset=utf-8"
) {
  response.writeHead(statusCode, {
    "Content-Type": contentType,
    "Cache-Control": "no-store"
  });
  response.end(body);
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
    case ".mjs":
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
    case ".woff":
      return "font/woff";
    case ".woff2":
      return "font/woff2";
    default:
      return "application/octet-stream";
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

async function fileExists(filePath) {
  try {
    const result = await stat(filePath);
    return result.isFile();
  } catch {
    return false;
  }
}

function getPathSegments(pathname) {
  return pathname.split("/").filter(Boolean);
}

async function handlePlatformApi(request, response, requestUrl) {
  const segments = getPathSegments(requestUrl.pathname);
  if (segments[0] !== "api" || segments[1] !== "platform") {
    return false;
  }

  const resource = segments[2];
  const resourceId = segments[3];
  const extraSegment = segments[4];

  try {
    if (request.method === "GET" && resource === "overview") {
      const runs = await runner.listRuns();
      const artifacts = await runner.listArtifacts();
      const overview = await store.buildOverview(runs, artifacts);
      jsonResponse(response, 200, { ok: true, overview });
      return true;
    }

    if (request.method === "GET" && resource === "state") {
      const state = await store.readState();
      const readiness = {
        mailConfigs: Object.fromEntries(
          state.mailConfigs.map((config) => [config.id, store.getMailReadiness(config)])
        )
      };
      jsonResponse(response, 200, { ok: true, state, readiness });
      return true;
    }

    if (resource === "sites") {
      if (request.method === "GET" && resourceId) {
        const state = await store.readState();
        const site = state.sites.find((record) => record.id === resourceId);

        if (!site) {
          jsonResponse(response, 404, { ok: false, message: "站点资源不存在。" });
          return true;
        }

        jsonResponse(response, 200, { ok: true, site });
        return true;
      }

      if (request.method === "GET") {
        const state = await store.readState();
        jsonResponse(response, 200, { ok: true, sites: state.sites });
        return true;
      }

      if (request.method === "DELETE" && resourceId) {
        const site = await store.deleteSite(resourceId);
        jsonResponse(response, 200, { ok: true, site });
        return true;
      }

      if (request.method === "POST" || request.method === "PUT") {
        const bodyText = await readBody(request);
        const payload = JSON.parse(bodyText || "{}");
        const site = await store.saveSite({
          ...payload,
          id: request.method === "PUT" ? resourceId : payload.id
        });
        jsonResponse(response, 200, { ok: true, site });
        return true;
      }
    }

    if (resource === "plans") {
      if (request.method === "GET") {
        const state = await store.readState();
        jsonResponse(response, 200, { ok: true, plans: state.plans });
        return true;
      }

      const bodyText = await readBody(request);
      const payload = JSON.parse(bodyText || "{}");
      if (request.method === "POST" || request.method === "PUT") {
        const plan = await store.savePlan({
          ...payload,
          id: request.method === "PUT" ? resourceId : payload.id
        });
        jsonResponse(response, 200, { ok: true, plan });
        return true;
      }
    }

    if (resource === "profiles") {
      if (request.method === "GET") {
        const state = await store.readState();
        jsonResponse(response, 200, { ok: true, profiles: state.profiles });
        return true;
      }

      const bodyText = await readBody(request);
      const payload = JSON.parse(bodyText || "{}");
      if (request.method === "POST" || request.method === "PUT") {
        const profile = await store.saveProfile({
          ...payload,
          id: request.method === "PUT" ? resourceId : payload.id
        });
        jsonResponse(response, 200, { ok: true, profile });
        return true;
      }
    }

    if (resource === "mail-configs") {
      if (request.method === "GET") {
        const state = await store.readState();
        jsonResponse(response, 200, { ok: true, mailConfigs: state.mailConfigs });
        return true;
      }

      if (request.method === "POST" && extraSegment === "test") {
        const result = await store.testMailConfigConnection(resourceId);
        jsonResponse(response, 200, { ok: true, result });
        return true;
      }

      if (request.method === "POST" || request.method === "PUT") {
        const bodyText = await readBody(request);
        const payload = JSON.parse(bodyText || "{}");
        const mailConfig = await store.saveMailConfig({
          ...payload,
          id: request.method === "PUT" ? resourceId : payload.id
        });
        jsonResponse(response, 200, { ok: true, mailConfig });
        return true;
      }
    }

    if (resource === "runs") {
      if (request.method === "GET" && !resourceId) {
        const runs = await runner.listRuns();
        jsonResponse(response, 200, {
          ok: true,
          runs,
          activeRunId: runs.find((run) => run.status === "running" || run.status === "stopping")?.id || null
        });
        return true;
      }

      if (request.method === "GET" && resourceId) {
        const run = await runner.getRunById(resourceId);
        if (!run) {
          jsonResponse(response, 404, { ok: false, message: "运行记录不存在。" });
          return true;
        }

        jsonResponse(response, 200, { ok: true, run });
        return true;
      }

      if (request.method === "POST" && resourceId === "stop") {
        const run = await runner.stopRun();
        jsonResponse(response, 200, { ok: true, run });
        return true;
      }

      if (request.method === "POST" && !resourceId) {
        const bodyText = await readBody(request);
        const payload = JSON.parse(bodyText || "{}");
        const run = await runner.startRun({
          planId: String(payload.planId || ""),
          mode: payload.mode,
          runCount: payload.runCount
        });
        jsonResponse(response, 200, { ok: true, run });
        return true;
      }
    }

    if (resource === "tasks" && request.method === "GET") {
      if (resourceId && extraSegment === "download") {
        const bundle = await store.buildTaskDownloadBundle(resourceId);
        response.writeHead(200, {
          "Content-Type": bundle.contentType,
          "Content-Disposition": `attachment; filename="${bundle.fileName}"`,
          "Cache-Control": "no-store"
        });
        response.end(bundle.buffer);
        return true;
      }

      const tasks = await store.listTasks();
      jsonResponse(response, 200, { ok: true, tasks });
      return true;
    }

    if (resource === "cases" && request.method === "GET") {
      const taskId = requestUrl.searchParams.get("taskId") || "";
      const cases = await store.listCases({ taskId });
      jsonResponse(response, 200, { ok: true, cases });
      return true;
    }

    if (resource === "artifacts" && request.method === "GET") {
      const runId = requestUrl.searchParams.get("runId") || "";
      const taskId = requestUrl.searchParams.get("taskId") || "";
      const caseId = requestUrl.searchParams.get("caseId") || "";
      const type = requestUrl.searchParams.get("type") || "";
      const artifacts = await runner.listArtifacts({ runId, taskId, caseId, type });
      jsonResponse(response, 200, { ok: true, artifacts });
      return true;
    }

    if (resource === "system") {
      if (request.method === "GET") {
        const state = await store.readState();
        jsonResponse(response, 200, { ok: true, system: state.system });
        return true;
      }

      if (request.method === "PUT") {
        const bodyText = await readBody(request);
        const payload = JSON.parse(bodyText || "{}");
        const system = await store.updateSystem(payload);
        jsonResponse(response, 200, { ok: true, system });
        return true;
      }
    }
  } catch (error) {
    jsonResponse(response, 400, {
      ok: false,
      message: error instanceof Error ? error.message : "平台接口执行失败。"
    });
    return true;
  }

  jsonResponse(response, 404, {
    ok: false,
    message: `接口不存在：${requestUrl.pathname}`
  });
  return true;
}

function resolvePlatformFile(bucket, relativePath) {
  const normalizedRelativePath = relativePath.replace(/^\/+/, "");

  if (bucket === "reports") {
    return path.resolve(reportDirPath, normalizedRelativePath);
  }

  if (bucket === "logs") {
    if (normalizedRelativePath === "test-output.log") {
      return path.resolve(projectRoot, "test-output.log");
    }

    return path.resolve(projectRoot, "test-results", normalizedRelativePath);
  }

  if (bucket === "media" || bucket === "trace") {
    return path.resolve(projectRoot, "test-results", normalizedRelativePath);
  }

  if (bucket === "tokens") {
    if (normalizedRelativePath.startsWith("artifacts/")) {
      return path.resolve(projectRoot, normalizedRelativePath);
    }

    return path.resolve(projectRoot, "output_tokens", normalizedRelativePath);
  }

  if (bucket === "artifacts") {
    return path.resolve(projectRoot, "artifacts", normalizedRelativePath);
  }

  return null;
}

async function serveConsole(response, requestUrl) {
  const buildExists = existsSync(path.join(consoleDistPath, "index.html"));

  if (!buildExists) {
    const message = `<!doctype html><html lang="zh-CN"><meta charset="utf-8" /><title>新版控制台尚未构建</title><body style="font-family:Segoe UI, sans-serif;padding:40px;background:#f4ede2;color:#3c2418"><h1>新版控制台尚未构建</h1><p>请先运行 <code>npm run console:build</code>，或在开发模式下运行 <code>npm run console:dev</code>。</p></body></html>`;
    textResponse(response, 503, message, "text/html; charset=utf-8");
    return true;
  }

  const requestedPath =
    requestUrl.pathname === "/" ? path.join(consoleDistPath, "index.html") : path.resolve(consoleDistPath, `.${requestUrl.pathname}`);

  if (requestedPath.startsWith(consoleDistPath) && (await fileExists(requestedPath))) {
    serveStaticFile(response, requestedPath);
    return true;
  }

  if (requestUrl.pathname.startsWith("/assets/")) {
    textResponse(response, 404, "Not Found");
    return true;
  }

  serveStaticFile(response, path.join(consoleDistPath, "index.html"));
  return true;
}

export function createConfigServer() {
  return createServer(async (request, response) => {
    const method = request.method ?? "GET";
    const requestUrl = new URL(request.url ?? "/", "http://127.0.0.1");

    if (method === "GET" && requestUrl.pathname === "/health") {
      jsonResponse(response, 200, { ok: true });
      return;
    }

    if (await handlePlatformApi(request, response, requestUrl)) {
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
      const absolutePath = path.resolve(reportDirPath, relativePath);

      if (!absolutePath.startsWith(reportDirPath)) {
        textResponse(response, 403, "Forbidden");
        return;
      }

      serveStaticFile(response, absolutePath);
      return;
    }

    if (method === "GET" && requestUrl.pathname.startsWith("/platform-artifacts/")) {
      const artifactId = decodeURIComponent(
        requestUrl.pathname.replace("/platform-artifacts/", "")
      );
      const storedArtifact = await store.getArtifactById(artifactId);

      if (!storedArtifact) {
        textResponse(response, 404, "Not Found");
        return;
      }

      response.writeHead(200, {
        "Content-Type": storedArtifact.contentType || "application/octet-stream",
        "Cache-Control": "no-store"
      });
      response.end(storedArtifact.contentBuffer);
      return;
    }

    if (method === "GET" && requestUrl.pathname.startsWith("/platform-files/")) {
      const [, , bucket, ...rest] = getPathSegments(requestUrl.pathname);
      const relativePath = rest.join("/");
      const storedArtifact = await store.getArtifactContent(bucket, relativePath);

      if (storedArtifact) {
        response.writeHead(200, {
          "Content-Type": storedArtifact.contentType || getContentType(relativePath),
          "Cache-Control": "no-store"
        });
        response.end(storedArtifact.contentBuffer);
        return;
      }

      const absolutePath = resolvePlatformFile(bucket, relativePath);

      if (!absolutePath) {
        textResponse(response, 404, "Not Found");
        return;
      }

      const allowedRoots = [
        path.join(projectRoot, "playwright-report"),
        path.join(projectRoot, "test-results"),
        path.join(projectRoot, "output_tokens"),
        path.join(projectRoot, "artifacts")
      ];

      const rootLogPath = path.join(projectRoot, "test-output.log");
      if (
        absolutePath !== rootLogPath &&
        !allowedRoots.some((rootPath) => absolutePath.startsWith(rootPath))
      ) {
        textResponse(response, 403, "Forbidden");
        return;
      }

      serveStaticFile(response, absolutePath);
      return;
    }

    if (requestUrl.pathname.startsWith("/api/")) {
      jsonResponse(response, 404, {
        ok: false,
        message: `接口不存在：${requestUrl.pathname}`
      });
      return;
    }

    if (method === "GET" && (await serveConsole(response, requestUrl))) {
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
    console.log(`平台控制台服务已启动: http://127.0.0.1:${port}`);
    console.log("根路径现在仅提供新版平台控制台。");
  });
}
