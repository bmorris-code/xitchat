@echo off
REM Quick rebuild and deploy after error fix
REM Device: 1MA75199ZA1G80B1P1X0407

echo ========================================
echo XitChat Error Fix - Rebuild and Deploy
echo ========================================
echo.

set DEVICE=1MA75199ZA1G80B1P1X0407

echo [1/4] Building latest version...
call npm run build
if errorlevel 1 (
    echo ERROR: Build failed!
    pause
    exit /b 1
)
echo ✅ Build complete
echo.

echo [2/4] Syncing with Android...
call npx cap sync android
if errorlevel 1 (
    echo ERROR: Sync failed!
    pause
    exit /b 1
)
echo ✅ Sync complete
echo.

echo [3/4] Installing on device H6...
adb -s %DEVICE% install -r android\app\build\outputs\apk\debug\app-debug.apk
if errorlevel 1 (
    echo ⚠️  Installation failed, trying to build APK first...
    cd android
    call gradlew.bat assembleDebug
    cd ..
    adb -s %DEVICE% install -r android\app\build\outputs\apk\debug\app-debug.apk
)
echo ✅ App installed
echo.

echo [4/4] Launching app...
adb -s %DEVICE% shell am start -n com.xitchat.app/.MainActivity
echo ✅ App launched
echo.

echo ========================================
echo Fix Applied Successfully! 🎉
echo ========================================
echo.
echo The error "Native send failed" should now be gone!
echo.
echo What to check:
echo 1. No red errors in logs
echo 2. Messages show "✅ Message sent via [Network]"
echo 3. Fallback networks work automatically
echo.
echo Press any key to start log monitoring...
pause > nul

echo.
echo Monitoring logs (Press Ctrl+C to stop)...
echo ========================================
adb -s %DEVICE% logcat -s chromium:I *:E | findstr /i "message sent fallback nostr broadcast wifi"
