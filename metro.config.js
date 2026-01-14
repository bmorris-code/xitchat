const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Add support for TypeScript and React
config.resolver.assetExts.push(
  // Add any additional asset extensions here
  'png', 'jpg', 'jpeg', 'gif', 'svg', 'webp'
);

// Add support for source files
config.resolver.sourceExts.push(
  'jsx', 'js', 'ts', 'tsx', 'json'
);

module.exports = config;
