#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const targets = [
  path.join(process.cwd(), 'dist', 'xitchat-v1.apk'),
  path.join(process.cwd(), 'dist', 'xitchat.apk')
];

for (const target of targets) {
  if (fs.existsSync(target)) {
    fs.unlinkSync(target);
    console.log(`Removed ${path.relative(process.cwd(), target)} from mobile build output`);
  }
}
