// This file serves as a mock API endpoint for Vite development
// In production, this will be handled by the appUpdateService logic

import { releaseInfo } from '../../services/releaseInfo';

export async function GET() {
  // Return dynamic release info based on current deployment
  const baseUrl = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000';
  
  const dynamicReleaseInfo = {
    version: releaseInfo.appVersion,
    versionCode: releaseInfo.appVersionCode,
    apkUrls: {
      production: `${baseUrl}/xitchat-v1.apk`,
      staging: `${baseUrl}/xitchat-v1.apk`,
      development: `${baseUrl}/xitchat-v1.apk`,
      downloadPage: `${baseUrl}/download.html`
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
