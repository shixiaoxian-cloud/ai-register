const allowedFields = [
  "userAgent",
  "uaData",
  "locale",
  "languages",
  "platform",
  "vendor",
  "timezone",
  "timezoneOffset",
  "viewport",
  "screen",
  "geolocation",
  "browserVersion"
];

function createFingerprintId() {
  return `browser-env-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

function getBrowserVersion() {
  const match = navigator.userAgent.match(/(Chrome|Edg|Firefox|Safari)\/([\d.]+)/);
  return match ? `${match[1]} ${match[2]}` : navigator.appVersion;
}

function getGeolocation() {
  return new Promise((resolve) => {
    if (!navigator.geolocation) {
      resolve(null);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy
        });
      },
      () => {
        resolve(null);
      },
      {
        enableHighAccuracy: true,
        timeout: 3000,
        maximumAge: 60_000
      }
    );
  });
}

async function collectFingerprint() {
  const collectBtn = document.getElementById("collectBtn");
  const downloadBtn = document.getElementById("downloadBtn");
  const copyBtn = document.getElementById("copyBtn");
  const status = document.getElementById("status");
  const output = document.getElementById("output");
  const preview = document.getElementById("preview");

  collectBtn.disabled = true;
  status.textContent = "正在收集浏览器环境配置...";

  const viewport = {
    width: Math.round(window.innerWidth),
    height: Math.round(window.innerHeight)
  };

  const screenInfo = {
    width: screen.width,
    height: screen.height,
    availWidth: screen.availWidth,
    availHeight: screen.availHeight,
    colorDepth: screen.colorDepth
  };

  const geolocation = await getGeolocation();
  const uaData = navigator.userAgentData;

  const fingerprint = {
    id: createFingerprintId(),
    collectedAt: new Date().toISOString(),
    userAgent: navigator.userAgent,
    uaData: uaData
      ? {
          brands: uaData.brands?.map((item) => ({ brand: item.brand, version: item.version })) || [],
          mobile: uaData.mobile || false,
          platform: uaData.platform || ""
        }
      : null,
    locale: navigator.language,
    languages: Array.from(navigator.languages || [navigator.language]),
    platform: navigator.platform,
    vendor: navigator.vendor || "",
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    timezoneOffset: new Date().getTimezoneOffset(),
    viewport,
    screen: screenInfo,
    geolocation,
    browserVersion: getBrowserVersion(),
    source: {
      method: "browser-export",
      approved: true
    }
  };

  displayPreview(fingerprint, preview);
  output.textContent = JSON.stringify(fingerprint, null, 2);
  status.textContent = "✅ 浏览器环境配置已收集";
  downloadBtn.disabled = false;
  copyBtn.disabled = false;

  window.browserEnvironmentConfig = fingerprint;
}

function displayPreview(fingerprint, previewNode) {
  if (!previewNode) return;

  const entries = [
    { key: "ID", value: fingerprint.id },
    { key: "采集时间", value: fingerprint.collectedAt },
    { key: "User Agent", value: fingerprint.userAgent },
    { key: "平台", value: fingerprint.platform },
    { key: "语言", value: fingerprint.languages.join(", ") },
    { key: "时区", value: fingerprint.timezone },
    { key: "Viewport", value: `${fingerprint.viewport.width}x${fingerprint.viewport.height}` },
    { key: "Screen", value: `${fingerprint.screen.width}x${fingerprint.screen.height}` },
    { key: "地理位置", value: fingerprint.geolocation ? `${fingerprint.geolocation.latitude}, ${fingerprint.geolocation.longitude}` : "未授权" },
    { key: "浏览器版本", value: fingerprint.browserVersion }
  ];

  previewNode.innerHTML = entries
    .map(
      (item) =>
        `<div class="fingerprint-item"><span class="fingerprint-key">${item.key}</span><span class="fingerprint-value">${item.value}</span></div>`
    )
    .join("");
}

function downloadJSON() {
  const data = window.browserEnvironmentConfig;
  if (!data) {
    alert("请先收集浏览器环境配置。");
    return;
  }
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `browser-env-${data.id}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

async function copyToClipboard() {
  const data = window.browserEnvironmentConfig;
  if (!data) {
    alert("请先收集浏览器环境配置。");
    return;
  }
  try {
    await navigator.clipboard.writeText(JSON.stringify(data, null, 2));
    alert("已复制配置 JSON，可以粘贴到授权站点的审批系统。");
  } catch (error) {
    alert("复制失败，请手动复制预览区域内容。");
  }
}

document.addEventListener("DOMContentLoaded", () => {
  const collectBtn = document.getElementById("collectBtn");
  if (collectBtn) {
    collectBtn.addEventListener("click", collectFingerprint);
  }
  const downloadBtn = document.getElementById("downloadBtn");
  if (downloadBtn) {
    downloadBtn.addEventListener("click", downloadJSON);
  }
  const copyBtn = document.getElementById("copyBtn");
  if (copyBtn) {
    copyBtn.addEventListener("click", copyToClipboard);
  }
});
