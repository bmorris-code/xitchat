// This file serves as a mock API endpoint for Vite development
// In production, this will be handled by the appUpdateService logic

import { APK_PATH, DOWNLOAD_PAGE_PATH, releaseInfo } from '../../services/releaseInfo';

export async function GET() {
  const dynamicReleaseInfo = {
    version: releaseInfo.appVersion,
    versionCode: releaseInfo.appVersionCode,
    apkUrls: {
      production: APK_PATH,
      staging: APK_PATH,
      development: APK_PATH,
      downloadPage: DOWNLOAD_PAGE_PATH
    },
    releaseNotes: "Bug fixes and performance improvements",
    forceUpdate: false,
    apkSize: 179840673,
    checksum: "sha256:a1b2c3d4e5f6...",
    minSupportedVersion: "1.0.0",
    updateCheckInterval: 21600000
  };

  // Return JSON response
  return new Response(JSON.stringify(dynamicReleaseInfo), {
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*'
    }
  });
}
