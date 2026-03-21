import { loadRuntimeReleaseInfo, releaseInfo } from './releaseInfo';

export interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

const getCapacitor = () => (window as any).Capacitor;

export const isNativePlatform = (): boolean => {
  if (typeof window === 'undefined') return false;
  return !!getCapacitor()?.isNativePlatform?.();
};

export const isStandalonePwa = (): boolean => {
  if (typeof window === 'undefined') return false;
  const mediaQueryMatch = window.matchMedia?.('(display-mode: standalone)').matches ?? false;
  const iosStandalone = (window.navigator as any).standalone === true;
  return mediaQueryMatch || iosStandalone;
};

export const isAndroidBrowser = (): boolean => {
  if (typeof navigator === 'undefined') return false;
  return /android/i.test(navigator.userAgent) && !isNativePlatform();
};

export const downloadApk = async () => {
  const runtimeReleaseInfo = await loadRuntimeReleaseInfo();
  const link = document.createElement('a');
  link.href = runtimeReleaseInfo.apkDownloadUrl;
  link.download = releaseInfo.apkFileName;
  link.rel = 'noopener';
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};
