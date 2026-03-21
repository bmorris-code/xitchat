#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const rootDir = process.cwd();
const candidates = [
  path.join(rootDir, 'android', 'app', 'build', 'outputs', 'apk', 'release', 'app-release.apk'),
  path.join(rootDir, 'android', 'app', 'build', 'outputs', 'apk', 'debug', 'app-debug.apk')
];
const outputPaths = [
  path.join(rootDir, 'public', 'xitchat-v1.apk'),
  path.join(rootDir, 'public', 'xitchat.apk')
];

const sourceApk = candidates.find((candidate) => fs.existsSync(candidate));

if (!sourceApk) {
  console.error('No built APK found in android/app/build/outputs/apk.');
  process.exit(1);
}

for (const outputPath of outputPaths) {
  fs.copyFileSync(sourceApk, outputPath);
  console.log(`Copied ${path.basename(sourceApk)} -> ${path.relative(rootDir, outputPath)}`);
}
