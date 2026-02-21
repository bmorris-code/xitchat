export interface ReleaseInfo {
  appVersion: string;
  appVersionCode: number;
  apkVersionLabel: string;
  apkDownloadUrl: string;
}

const parsedVersionCode = Number.parseInt(import.meta.env.VITE_APP_VERSION_CODE || '', 10);

export const releaseInfo: ReleaseInfo = {
  appVersion: import.meta.env.VITE_APP_VERSION || '1.0.0',
  appVersionCode: Number.isFinite(parsedVersionCode) && parsedVersionCode > 0 ? parsedVersionCode : 1,
  apkVersionLabel: import.meta.env.VITE_APK_VERSION_LABEL || import.meta.env.VITE_APP_VERSION || '1.0.0',
  apkDownloadUrl: import.meta.env.VITE_APK_DOWNLOAD_URL || '/xitchat-v1.apk'
};
