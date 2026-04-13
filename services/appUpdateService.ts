import { Capacitor } from '@capacitor/core';
import { App } from '@capacitor/app';
import { APK_PATH, DOWNLOAD_PAGE_PATH, releaseInfo } from './releaseInfo';

export interface UpdateInfo {
  version: string;
  versionCode: number;
  downloadUrl: string;
  releaseNotes: string;
  forceUpdate: boolean;
  apkSize: number;
}

export interface UpdateCheckResult {
  hasUpdate: boolean;
  updateInfo?: UpdateInfo;
  currentVersion: string;
  currentVersionCode: number;
}

interface ReleaseConfig {
  version: string;
  versionCode: number;
  apkUrls: {
    production: string;
    staging: string;
    development: string;
  };
  releaseNotes: string;
  forceUpdate: boolean;
  apkSize: number;
  checksum: string;
  minSupportedVersion: string;
  updateCheckInterval: number;
}

class AppUpdateService {
  private static instance: AppUpdateService;
  private updateCheckInterval: NodeJS.Timeout | null = null;
  private readonly UPDATE_CHECK_INTERVAL = 6 * 60 * 60 * 1000; // 6 hours
  private readonly UPDATE_API_URL = '/api/version-check';
  private releaseConfig: ReleaseConfig | null = null;

  private constructor() {}

  static getInstance(): AppUpdateService {
    if (!AppUpdateService.instance) {
      AppUpdateService.instance = new AppUpdateService();
    }
    return AppUpdateService.instance;
  }

  /**
   * Load release configuration
   */
  private async loadReleaseConfig(): Promise<ReleaseConfig> {
    if (this.releaseConfig) {
      return this.releaseConfig;
    }

    try {
      // Fallback to config file in public folder
      const response = await fetch('/config/release.json');
      if (!response.ok) {
        throw new Error('Failed to load release config');
      }
      this.releaseConfig = await response.json();
      return this.releaseConfig;
    } catch (error) {
      console.debug('Failed to load release config, using defaults:', error);
      // Fallback config with dynamic URL
      const baseUrl = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000';
      return {
        version: releaseInfo.appVersion,
        versionCode: releaseInfo.appVersionCode,
        apkUrls: {
          production: `${baseUrl}${APK_PATH}`,
          staging: `${baseUrl}${APK_PATH}`,
          development: `${baseUrl}${APK_PATH}`
        },
        releaseNotes: 'Bug fixes and performance improvements',
        forceUpdate: false,
        apkSize: 179840673,
        checksum: 'sha256:a1b2c3d4e5f6...',
        minSupportedVersion: '1.0.0',
        updateCheckInterval: 21600000
      };
    }
  }

  /**
   * Get current app version info
   */
  getCurrentVersion(): { version: string; versionCode: number } {
    // For web, use package.json version
    if (!Capacitor.isNativePlatform()) {
      return {
        version: releaseInfo.appVersion,
        versionCode: releaseInfo.appVersionCode
      };
    }

    // For native apps, get from build config
    return {
      version: releaseInfo.appVersion,
      versionCode: releaseInfo.appVersionCode
    };
  }

  /**
   * Check for updates from server
   */
  async checkForUpdates(): Promise<UpdateCheckResult> {
    const currentVersion = this.getCurrentVersion();
    
    try {
      // Check against server first
      const response = await fetch(this.UPDATE_API_URL);
      if (!response.ok) {
        throw new Error('Failed to check for updates');
      }

      const serverVersion: UpdateInfo = await response.json();
      
      return this.compareVersions(currentVersion, serverVersion);

    } catch (error) {
      console.debug('Update check API failed, trying release config fallback:', error);
      try {
        const config = await this.loadReleaseConfig();
        const hostname = window.location.hostname;
        const downloadUrl =
          hostname.includes('staging')
            ? config.apkUrls.staging
            : hostname === 'localhost' || hostname === '127.0.0.1'
              ? config.apkUrls.development
              : config.apkUrls.production;

        const serverVersion: UpdateInfo = {
          version: config.version,
          versionCode: config.versionCode,
          downloadUrl,
          releaseNotes: config.releaseNotes,
          forceUpdate: config.forceUpdate,
          apkSize: config.apkSize
        };
        return this.compareVersions(currentVersion, serverVersion);
      } catch (fallbackError) {
        console.debug('Update check fallback failed:', fallbackError);
        return {
          hasUpdate: false,
          currentVersion: currentVersion.version,
          currentVersionCode: currentVersion.versionCode
        };
      }
    }
  }

  /**
   * Compare current version with server version
   */
  private compareVersions(current: { version: string; versionCode: number }, server: UpdateInfo): UpdateCheckResult {
    const hasUpdate = server.versionCode > current.versionCode;

    return {
      hasUpdate,
      updateInfo: hasUpdate ? server : undefined,
      currentVersion: current.version,
      currentVersionCode: current.versionCode
    };
  }

  /**
   * Download and install APK update
   */
  async downloadAndInstallUpdate(updateInfo: UpdateInfo): Promise<void> {
    if (!Capacitor.isNativePlatform()) {
      // For web, redirect to dedicated download page
      try {
        // Check if download page URL exists
        const downloadPageUrl = updateInfo.downloadUrl?.includes('downloadPage') 
          ? DOWNLOAD_PAGE_PATH
          : updateInfo.downloadUrl;
          
        // Method 1: Redirect to download page
        window.location.href = downloadPageUrl;
        
      } catch (error) {
        console.error('Download redirect failed, trying direct:', error);
        // Fallback: Direct download
        const link = document.createElement('a');
        link.href = updateInfo.downloadUrl;
        link.download = `xitchat-v${updateInfo.version}.apk`;
        link.style.display = 'none';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }
      return;
    }

    try {
      console.log('Downloading update:', updateInfo.downloadUrl);
      
      // For native Android, we'd use Capacitor's Filesystem and App plugins
      // This is a simplified version - in production you'd:
      // 1. Download APK to device storage
      // 2. Request install permissions
      // 3. Trigger installation via intent
      
      if (Capacitor.getPlatform() === 'android') {
        // Use Capacitor's HTTP plugin to download
        // Then use File System plugin to save
        // Finally use App plugin to trigger install
        
        console.log('Android update download initiated');
        // Implementation would go here
      }

    } catch (error) {
      console.error('Failed to download update:', error);
      throw error;
    }
  }

  /**
   * Start periodic update checks
   */
  startPeriodicChecks(): void {
    if (this.updateCheckInterval) {
      clearInterval(this.updateCheckInterval);
    }

    this.updateCheckInterval = setInterval(async () => {
      try {
        const result = await this.checkForUpdates();
        if (result.hasUpdate && result.updateInfo) {
          this.notifyUpdateAvailable(result.updateInfo);
        }
      } catch (error) {
        console.debug('Periodic update check failed:', error);
      }
    }, this.UPDATE_CHECK_INTERVAL);
  }

  /**
   * Stop periodic update checks
   */
  stopPeriodicChecks(): void {
    if (this.updateCheckInterval) {
      clearInterval(this.updateCheckInterval);
      this.updateCheckInterval = null;
    }
  }

  /**
   * Notify user about available update
   */
  private notifyUpdateAvailable(updateInfo: UpdateInfo): void {
    // Create custom event for UI components to listen to
    const event = new CustomEvent('appUpdateAvailable', {
      detail: updateInfo
    });
    window.dispatchEvent(event);
  }

  /**
   * Check if update is mandatory
   */
  isUpdateMandatory(updateInfo: UpdateInfo): boolean {
    return updateInfo.forceUpdate;
  }

  /**
   * Format file size for display
   */
  formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  /**
   * Get download progress (for UI updates)
   */
  async getDownloadProgress(): Promise<number> {
    // Implementation would track download progress
    return 0;
  }
}

export const appUpdateService = AppUpdateService.getInstance();
