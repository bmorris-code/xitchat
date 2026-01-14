@echo off
REM XitChat Native Build Script for Windows

echo 🚀 Building XitChat for Native Deployment...

REM Build the web app first
echo 📦 Building web app...
call npm run build

if %ERRORLEVEL% neq 0 (
    echo ❌ Web build failed!
    exit /b 1
)

REM Add native platforms
echo 📱 Adding iOS platform...
npx cap add ios

echo 🤖 Adding Android platform...
npx cap add android

REM Copy web assets to native platforms
echo 📋 Syncing web assets to native platforms...
npx cap sync

if %ERRORLEVEL% neq 0 (
    echo ❌ Sync failed!
    exit /b 1
)

echo ✅ Native build complete!
echo.
echo Next steps:
echo 1. Open iOS: npx cap open ios
echo 2. Open Android: npx cap open android
echo 3. Run on device: npx cap run ios/android
echo.
pause
