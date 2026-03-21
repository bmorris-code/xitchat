export interface ReleaseInfo {
  appVersion: string;
  appVersionCode: number;
  apkVersionLabel: string;
  apkDownloadUrl: string;
  apkFileName: string;
  downloadPageUrl: string;
}

const DEFAULT_APP_VERSION = '1.0.1';
const DEFAULT_APP_VERSION_CODE = 2;
const DEFAULT_APK_PATH = '/xitchat-v1.apk';
const DEFAULT_DOWNLOAD_PAGE_PATH = '/download.html';
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
  const configured = import.meta.env.VITE_APK_DOWNLOAD_URL;
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

export const releaseInfo: ReleaseInfo = {
  appVersion: RELEASE_VERSION,
  appVersionCode: RELEASE_VERSION_CODE,
  apkVersionLabel: import.meta.env.VITE_APK_VERSION_LABEL || RELEASE_VERSION,
  apkDownloadUrl: getSafeConfiguredApkUrl(),
  apkFileName: `xitchat-v${import.meta.env.VITE_APK_VERSION_LABEL || RELEASE_VERSION}.apk`,
  downloadPageUrl: getAbsoluteUrl(DOWNLOAD_PAGE_PATH)
};
