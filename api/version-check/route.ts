import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const baseUrl = request.nextUrl.origin;
  
  const releaseInfo = {
    version: "1.0.1",
    versionCode: 2,
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

  return NextResponse.json(releaseInfo);
}
