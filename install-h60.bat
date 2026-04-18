@echo off
REM XitChat H60 Quick Install Script
REM Device: 1MA75199ZA1G80B1P1X0407

echo ========================================
echo XitChat H60 Quick Install
echo ========================================
echo.

REM Set device ID
set DEVICE=1MA75199ZA1G80B1P1X0407

echo [1/4] Checking device connection...
adb -s %DEVICE% get-state
if errorlevel 1 (
    echo ERROR: Device H60 not connected!
    echo Please connect device and enable USB debugging.
    pause
    exit /b 1
)
echo ✅ Device H60 connected
echo.

echo [2/4] Installing XitChat APK...
if exist "xitchat-v1.apk" (
    adb -s %DEVICE% install -r xitchat-v1.apk
    if errorlevel 1 (
        echo ERROR: Installation failed!
        pause
        exit /b 1
    )
    echo ✅ APK installed successfully
) else (
    echo ERROR: xitchat-v1.apk not found!
    echo Please run build-android.bat first.
    pause
    exit /b 1
)
echo.

echo [3/4] Launching XitChat...
adb -s %DEVICE% shell am start -n com.xitchat.app/.MainActivity
if errorlevel 1 (
    echo ERROR: Failed to launch app!
    pause
    exit /b 1
)
echo ✅ App launched successfully
echo.

echo [4/4] Verifying app status...
adb -s %DEVICE% shell dumpsys activity activities | findstr "com.xitchat.app" >nul
if errorlevel 1 (
    echo ⚠️  App may not be running properly
) else (
    echo ✅ App is running successfully
)
echo.

echo ========================================
echo Installation Complete! 🎉
echo ========================================
echo.
echo Your H60 device now has XitChat installed and running.
echo.
echo Next Steps:
echo 1. Check your H60 device - XitChat should be open
echo 2. Grant all permissions when prompted
echo 3. For debugging: run test-android-logs.bat
echo.
pause
