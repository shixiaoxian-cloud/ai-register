/**
 * 浏览器指纹收集器
 * 自动收集当前浏览器的完整指纹信息
 */

let collectedFingerprint = null;

/**
 * 收集浏览器指纹
 */
async function collectFingerprint() {
  const collectBtn = document.getElementById('collectBtn');
  const downloadBtn = document.getElementById('downloadBtn');
  const copyBtn = document.getElementById('copyBtn');
  const status = document.getElementById('status');
  const progressContainer = document.getElementById('progress-container');
  const progressBar = document.getElementById('progress-bar');
  const preview = document.getElementById('preview');
  const output = document.getElementById('output');

  // 禁用按钮
  collectBtn.disabled = true;
  downloadBtn.disabled = true;
  copyBtn.disabled = true;

  // 显示进度条
  progressContainer.style.display = 'block';
  status.className = 'status info';
  status.textContent = '正在收集指纹数据...';

  try {
    const fingerprint = {
      id: generateId(),
      name: `${getBrowserName()} ${getBrowserVersion()} (${getOSName()})`,
      description: `从 ${window.location.hostname} 导出于 ${new Date().toLocaleString('zh-CN')}`,
      version: getBrowserVersion(),

      // 基础配置
      stealthMode: true,
      telemetryMode: 'block',

      // 浏览器指纹
      userAgent: navigator.userAgent,
      platform: navigator.platform,
      vendor: navigator.vendor || '',
      language: navigator.language,
      languages: navigator.languages ? Array.from(navigator.languages) : [navigator.language],

      // User Agent Data (高熵值)
      uaData: await collectUserAgentData(),

      // 硬件指纹
      hardwareConcurrency: navigator.hardwareConcurrency || 4,
      deviceMemory: navigator.deviceMemory || 8,
      maxTouchPoints: navigator.maxTouchPoints || 0,

      // 屏幕指纹
      screen: {
        width: screen.width,
        height: screen.height,
        availWidth: screen.availWidth,
        availHeight: screen.availHeight,
        colorDepth: screen.colorDepth,
        pixelDepth: screen.pixelDepth
      },

      // WebGL 指纹
      webgl: collectWebGLFingerprint(),

      // Canvas 指纹配置
      canvas: {
        noiseEnabled: true,
        noiseLevel: 0.001
      },

      // Audio 指纹配置
      audio: {
        noiseEnabled: true,
        noiseLevel: 0.00005
      },

      // 时区和地理位置
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      timezoneOffset: new Date().getTimezoneOffset(),
      geolocation: null, // 需要用户授权，暂不收集

      // 网络指纹
      connection: collectConnectionInfo(),

      // 电池 API
      battery: await collectBatteryInfo(),

      // Plugins
      plugins: collectPlugins(),

      // HTTP 头配置
      headers: generateHeaders(),

      // 元数据
      source: 'browser-export',
      sourceUrl: window.location.href,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    updateProgress(100);
    collectedFingerprint = fingerprint;

    // 显示成功状态
    status.className = 'status success';
    status.textContent = '✅ 指纹收集完成！';

    // 启用下载和复制按钮
    downloadBtn.disabled = false;
    copyBtn.disabled = false;

    // 显示预览
    displayPreview(fingerprint);

    // 显示完整 JSON
    output.style.display = 'block';
    output.textContent = JSON.stringify(fingerprint, null, 2);

  } catch (error) {
    status.className = 'status warning';
    status.textContent = `❌ 收集失败: ${error.message}`;
    console.error('Fingerprint collection error:', error);
  } finally {
    collectBtn.disabled = false;
    setTimeout(() => {
      progressContainer.style.display = 'none';
      progressBar.style.width = '0%';
    }, 1000);
  }
}

/**
 * 更新进度条
 */
function updateProgress(percent) {
  const progressBar = document.getElementById('progress-bar');
  progressBar.style.width = `${percent}%`;
}

/**
 * 收集 User Agent Data
 */
async function collectUserAgentData() {
  updateProgress(20);

  if (!navigator.userAgentData) {
    return {
      brands: [],
      mobile: false,
      platform: navigator.platform || 'Unknown',
      architecture: '',
      bitness: '',
      model: '',
      platformVersion: '',
      fullVersionList: []
    };
  }

  try {
    const highEntropyValues = await navigator.userAgentData.getHighEntropyValues([
      'architecture',
      'bitness',
      'brands',
      'fullVersionList',
      'mobile',
      'model',
      'platform',
      'platformVersion',
      'uaFullVersion'
    ]);

    return {
      brands: highEntropyValues.brands || [],
      mobile: highEntropyValues.mobile || false,
      platform: highEntropyValues.platform || '',
      architecture: highEntropyValues.architecture || '',
      bitness: highEntropyValues.bitness || '',
      model: highEntropyValues.model || '',
      platformVersion: highEntropyValues.platformVersion || '',
      fullVersionList: highEntropyValues.fullVersionList || []
    };
  } catch (error) {
    console.warn('Failed to collect high entropy values:', error);
    return {
      brands: navigator.userAgentData.brands || [],
      mobile: navigator.userAgentData.mobile || false,
      platform: navigator.userAgentData.platform || '',
      architecture: '',
      bitness: '',
      model: '',
      platformVersion: '',
      fullVersionList: []
    };
  }
}

/**
 * 收集 WebGL 指纹
 */
function collectWebGLFingerprint() {
  updateProgress(40);

  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');

    if (!gl) {
      return {
        vendor: 'Unknown',
        renderer: 'Unknown'
      };
    }

    const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
    if (debugInfo) {
      return {
        vendor: gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL) || 'Unknown',
        renderer: gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL) || 'Unknown'
      };
    }

    return {
      vendor: gl.getParameter(gl.VENDOR) || 'Unknown',
      renderer: gl.getParameter(gl.RENDERER) || 'Unknown'
    };
  } catch (error) {
    console.warn('Failed to collect WebGL fingerprint:', error);
    return {
      vendor: 'Unknown',
      renderer: 'Unknown'
    };
  }
}

/**
 * 收集网络连接信息
 */
function collectConnectionInfo() {
  updateProgress(60);

  if (!navigator.connection && !navigator.mozConnection && !navigator.webkitConnection) {
    return null;
  }

  const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;

  return {
    effectiveType: connection.effectiveType || '4g',
    rtt: connection.rtt || 50,
    downlink: connection.downlink || 10
  };
}

/**
 * 收集电池信息
 */
async function collectBatteryInfo() {
  updateProgress(70);

  if (!navigator.getBattery) {
    return null;
  }

  try {
    const battery = await navigator.getBattery();
    return {
      charging: battery.charging,
      level: battery.level,
      chargingTime: battery.chargingTime,
      dischargingTime: battery.dischargingTime
    };
  } catch (error) {
    console.warn('Failed to collect battery info:', error);
    return null;
  }
}

/**
 * 收集插件信息
 */
function collectPlugins() {
  updateProgress(80);

  const plugins = [];

  for (let i = 0; i < navigator.plugins.length; i++) {
    const plugin = navigator.plugins[i];
    const mimeTypes = [];

    for (let j = 0; j < plugin.length; j++) {
      const mimeType = plugin[j];
      mimeTypes.push({
        type: mimeType.type,
        suffixes: mimeType.suffixes,
        description: mimeType.description
      });
    }

    plugins.push({
      name: plugin.name,
      description: plugin.description,
      filename: plugin.filename,
      mimeTypes: mimeTypes
    });
  }

  return plugins;
}

/**
 * 生成 HTTP 头配置
 */
function generateHeaders() {
  updateProgress(90);

  const uaData = navigator.userAgentData;
  const brands = uaData?.brands || [];
  const platform = uaData?.platform || navigator.platform || 'Windows';
  const mobile = uaData?.mobile || false;

  // 构建 Sec-CH-UA 头
  let secChUa = '';
  if (brands.length > 0) {
    secChUa = brands.map(b => `"${b.brand}";v="${b.version}"`).join(', ');
  } else {
    secChUa = '"Chromium";v="131", "Not_A Brand";v="24", "Google Chrome";v="131"';
  }

  return {
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
    'Accept-Encoding': 'gzip, deflate, br, zstd',
    'Accept-Language': navigator.language + ',' + navigator.language.split('-')[0] + ';q=0.9',
    'Sec-CH-UA': secChUa,
    'Sec-CH-UA-Mobile': mobile ? '?1' : '?0',
    'Sec-CH-UA-Platform': `"${platform}"`,
    'Sec-Fetch-Dest': 'document',
    'Sec-Fetch-Mode': 'navigate',
    'Sec-Fetch-Site': 'none',
    'Sec-Fetch-User': '?1'
  };
}

/**
 * 显示指纹预览
 */
function displayPreview(fingerprint) {
  const preview = document.getElementById('preview');

  const items = [
    { key: '名称', value: fingerprint.name },
    { key: '版本', value: fingerprint.version },
    { key: 'User Agent', value: fingerprint.userAgent },
    { key: '平台', value: fingerprint.platform },
    { key: '语言', value: fingerprint.languages.join(', ') },
    { key: 'CPU 核心数', value: fingerprint.hardwareConcurrency },
    { key: '内存大小', value: `${fingerprint.deviceMemory} GB` },
    { key: '屏幕分辨率', value: `${fingerprint.screen.width}x${fingerprint.screen.height}` },
    { key: 'WebGL Vendor', value: fingerprint.webgl.vendor },
    { key: 'WebGL Renderer', value: fingerprint.webgl.renderer },
    { key: '时区', value: fingerprint.timezone },
    { key: '插件数量', value: fingerprint.plugins.length }
  ];

  preview.innerHTML = items.map(item => `
    <div class="fingerprint-item">
      <span class="fingerprint-key">${item.key}</span>
      <span class="fingerprint-value">${item.value}</span>
    </div>
  `).join('');
}

/**
 * 下载 JSON 文件
 */
function downloadJSON() {
  if (!collectedFingerprint) {
    alert('请先收集指纹数据');
    return;
  }

  const json = JSON.stringify(collectedFingerprint, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `fingerprint-${collectedFingerprint.id}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);

  const status = document.getElementById('status');
  status.className = 'status success';
  status.textContent = '✅ JSON 文件已下载';
}

/**
 * 复制到剪贴板
 */
async function copyToClipboard() {
  if (!collectedFingerprint) {
    alert('请先收集指纹数据');
    return;
  }

  const json = JSON.stringify(collectedFingerprint, null, 2);

  try {
    await navigator.clipboard.writeText(json);
    const status = document.getElementById('status');
    status.className = 'status success';
    status.textContent = '✅ 已复制到剪贴板';
  } catch (error) {
    alert('复制失败: ' + error.message);
  }
}

/**
 * 工具函数：生成唯一 ID
 */
function generateId() {
  return 'fp_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}

/**
 * 工具函数：获取浏览器名称
 */
function getBrowserName() {
  const ua = navigator.userAgent;
  if (ua.includes('Edg/')) return 'Edge';
  if (ua.includes('Chrome/')) return 'Chrome';
  if (ua.includes('Firefox/')) return 'Firefox';
  if (ua.includes('Safari/') && !ua.includes('Chrome')) return 'Safari';
  return 'Unknown';
}

/**
 * 工具函数：获取浏览器版本
 */
function getBrowserVersion() {
  const ua = navigator.userAgent;
  const match = ua.match(/(Edg|Chrome|Firefox|Safari)\/(\d+\.\d+\.\d+\.\d+)/);
  return match ? match[2] : 'Unknown';
}

/**
 * 工具函数：获取操作系统名称
 */
function getOSName() {
  const ua = navigator.userAgent;
  if (ua.includes('Windows NT 10.0')) return 'Windows 11';
  if (ua.includes('Windows NT')) return 'Windows';
  if (ua.includes('Mac OS X')) return 'macOS';
  if (ua.includes('Linux')) return 'Linux';
  return 'Unknown';
}
