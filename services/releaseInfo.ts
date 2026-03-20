export interface ReleaseInfo {
  appVersion: string;
  appVersionCode: number;
  apkVersionLabel: string;
  apkDownloadUrl: string;
}

const parsedVersionCode = Number.parseInt(import.meta.env.VITE_APP_VERSION_CODE || '', 10);

// Dynamic APK URL based on current deployment
const getDynamicApkUrl = () => {
  if (typeof window !== 'undefined') {
    return `${window.location.origin}/xitchat-v1.apk`;
  }
  return '/xitchat-v1.apk'; // Fallback for SSR
};

export const releaseInfo: ReleaseInfo = {
  appVersion: import.meta.env.VITE_APP_VERSION || '1.0.1',
  appVersionCode: Number.isFinite(parsedVersionCode) && parsedVersionCode > 0 ? parsedVersionCode : 2,
  apkVersionLabel: import.meta.env.VITE_APK_VERSION_LABEL || import.meta.env.VITE_APP_VERSION || '1.0.1',
  // APK served from same domain (Vercel)
  apkDownloadUrl: import.meta.env.VITE_APK_DOWNLOAD_URL || getDynamicApkUrl()
};
