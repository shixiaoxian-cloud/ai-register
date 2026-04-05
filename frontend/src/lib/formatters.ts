export function formatDateTime(value: string | undefined) {
  if (!value) {
    return "—";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  }).format(date);
}

export function formatBytes(value: number) {
  if (!Number.isFinite(value) || value <= 0) {
    return "0 B";
  }

  const units = ["B", "KB", "MB", "GB"];
  let size = value;
  let index = 0;

  while (size >= 1024 && index < units.length - 1) {
    size /= 1024;
    index += 1;
  }

  return `${size.toFixed(size >= 10 || index === 0 ? 0 : 1)} ${units[index]}`;
}

export function toneForStatus(status: string) {
  if (status === "passed" || status === "success") {
    return "success";
  }
  if (status === "failed" || status === "stopped") {
    return "danger";
  }
  if (status === "running" || status === "stopping") {
    return "accent";
  }
  return "neutral";
}

export function formatRunStatus(status: string) {
  const labels: Record<string, string> = {
    idle: "空闲",
    running: "运行中",
    stopping: "停止中",
    passed: "已通过",
    failed: "已失败",
    stopped: "已停止",
    success: "成功",
    unknown: "未知"
  };

  return labels[status] || status;
}

export function formatArtifactType(type: string) {
  const labels: Record<string, string> = {
    report: "报告",
    token: "令牌",
    media: "媒体",
    trace: "追踪",
    log: "日志"
  };

  return labels[type] || type;
}
