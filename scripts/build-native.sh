#!/bin/bash

# XitChat Native Build Script
echo "🚀 Building XitChat for Native Deployment..."

# Build the web app first
echo "📦 Building web app..."
npm run build

# Add native platforms
echo "📱 Adding iOS platform..."
npx cap add ios

echo "🤖 Adding Android platform..."
npx cap add android

# Copy web assets to native platforms
echo "📋 Syncing web assets to native platforms..."
npx cap sync

echo "✅ Native build complete!"
echo ""
echo "Next steps:"
echo "1. Open iOS: npx cap open ios"
echo "2. Open Android: npx cap open android"
echo "3. Run on device: npx cap run ios/android"
