export interface ReleaseInfo {
  appVersion: string;
  appVersionCode: number;
  apkVersionLabel: string;
  apkDownloadUrl: string;
  apkFileName: string;
  downloadPageUrl: string;
}

const DEFAULT_APP_VERSION = '1.0.2';
const DEFAULT_APP_VERSION_CODE = 3;
const DEFAULT_APK_PATH = '/xitchat-v1.apk';
const DEFAULT_DOWNLOAD_PAGE_PATH = '/download.html';
const DEFAULT_GITHUB_APK_URL = 'https://github.com/bmorris-code/xitchat/releases/latest/download/xitchat-v1.apk';
const parsedVersionCode = Number.parseInt(import.meta.env.VITE_APP_VERSION_CODE || '', 10);

export const RELEASE_VERSION = import.meta.env.VITE_APP_VERSION || DEFAULT_APP_VERSION;
export const RELEASE_VERSION_CODE = Number.isFinite(parsedVersionCode) && parsedVersionCode > 0
  ? parsedVersionCode
  : DEFAULT_APP_VERSION_CODE;
export const APK_PATH = import.meta.env.VITE_APK_PATH || DEFAULT_APK_PATH;
export const DOWNLOAD_PAGE_PATH = import.meta.env.VITE_APK_DOWNLOAD_PAGE || DEFAULT_DOWNLOAD_PAGE_PATH;

const getAbsoluteUrl = (path: string) => {
  if (typeof window !== 'undefined') {
    return new URL(path, window.location.origin).toString();
  }
  return path;
};

const getSafeConfiguredApkUrl = () => {
  const configured = import.meta.env.VITE_APK_DOWNLOAD_URL || DEFAULT_GITHUB_APK_URL;
  if (!configured) return getAbsoluteUrl(APK_PATH);

  try {
    if (typeof window !== 'undefined') {
      const resolved = new URL(configured, window.location.origin);
      if (window.location.protocol === 'https:' && resolved.protocol !== 'https:') {
        return getAbsoluteUrl(APK_PATH);
      }
      return resolved.toString();
    }
    return configured;
  } catch {
    return getAbsoluteUrl(APK_PATH);
  }
};

const resolveRuntimeUrl = (value: string, fallback: string) => {
  try {
    if (typeof window !== 'undefined') {
      const resolved = new URL(value, window.location.origin);
      if (window.location.protocol === 'https:' && resolved.protocol !== 'https:') {
        return fallback;
      }
      return resolved.toString();
    }
    return value;
  } catch {
    return fallback;
  }
};

let runtimeReleaseConfigPromise: Promise<{ apkDownloadUrl: string; downloadPageUrl: string; } | null> | null = null;

export const loadRuntimeReleaseInfo = async () => {
  if (typeof window === 'undefined') {
    return {
      apkDownloadUrl: releaseInfo.apkDownloadUrl,
      downloadPageUrl: releaseInfo.downloadPageUrl
    };
  }

  if (!runtimeReleaseConfigPromise) {
    runtimeReleaseConfigPromise = fetch('/config/release.json', { cache: 'no-store' })
      .then(async (response) => {
        if (!response.ok) throw new Error('Failed to load release config');
        const config = await response.json();
        const apkUrl = config?.apkUrls?.production || config?.apkUrl || releaseInfo.apkDownloadUrl;
        const downloadPage = config?.apkUrls?.downloadPage || DOWNLOAD_PAGE_PATH;

        return {
          apkDownloadUrl: resolveRuntimeUrl(apkUrl, releaseInfo.apkDownloadUrl),
          downloadPageUrl: resolveRuntimeUrl(downloadPage, releaseInfo.downloadPageUrl)
        };
      })
      .catch(() => null);
  }

  const runtimeConfig = await runtimeReleaseConfigPromise;
  return runtimeConfig || {
    apkDownloadUrl: releaseInfo.apkDownloadUrl,
    downloadPageUrl: releaseInfo.downloadPageUrl
  };
};

export const releaseInfo: ReleaseInfo = {
  appVersion: RELEASE_VERSION,
  appVersionCode: RELEASE_VERSION_CODE,
  apkVersionLabel: import.meta.env.VITE_APK_VERSION_LABEL || RELEASE_VERSION,
  apkDownloadUrl: getSafeConfiguredApkUrl(),
  apkFileName: `xitchat-v${import.meta.env.VITE_APK_VERSION_LABEL || RELEASE_VERSION}.apk`,
  downloadPageUrl: getAbsoluteUrl(DOWNLOAD_PAGE_PATH)
};
