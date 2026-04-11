export {};

declare global {
  interface Navigator {
    webdriver?: boolean;
    userAgentData?: {
      brands: Array<{ brand: string; version: string }>;
      mobile: boolean;
      platform: string;
    };
    getBattery?: () => Promise<{
      charging: boolean;
      chargingTime: number;
      dischargingTime: number;
      level: number;
      addEventListener: () => void;
      removeEventListener: () => void;
      dispatchEvent: () => boolean;
    }>;
    connection?: {
      rtt?: number;
      downlink?: number;
      effectiveType?: string;
    };
    plugins?: PluginArray;
    languages?: string[];
    mimeTypes?: MimeTypeArray;
  }

  interface Window {
    chrome?: {
      runtime?: unknown;
      loadTimes?: () => unknown;
      app?: Record<string, unknown>;
    };
  }
}
