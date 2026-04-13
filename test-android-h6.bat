@echo off
REM XitChat Android H6 Testing Script
REM Device: 1MA75199ZA1G80B1P1X0407

echo ========================================
echo XitChat Android H6 Real-Time Testing
echo ========================================
echo.

REM Set device ID
set DEVICE=1MA75199ZA1G80B1P1X0407

echo [1/6] Checking device connection...
adb -s %DEVICE% get-state
if errorlevel 1 (
    echo ERROR: Device H6 not connected!
    echo Please connect device and enable USB debugging.
    pause
    exit /b 1
)
echo ✅ Device H6 connected
echo.

echo [2/6] Checking if app is installed...
adb -s %DEVICE% shell pm list packages | findstr "xitchat"
if errorlevel 1 (
    echo ⚠️  XitChat not installed on device
    echo Installing app...
    goto :install
) else (
    echo ✅ XitChat already installed
    echo.
    
    echo Do you want to reinstall? (Y/N)
    set /p REINSTALL=
    if /i "%REINSTALL%"=="Y" goto :install
    goto :launch
)

:install
echo.
echo [3/6] Building latest version...
call npx cap sync android
if errorlevel 1 (
    echo ERROR: Capacitor sync failed!
    pause
    exit /b 1
)

echo.
echo [4/6] Building APK...
cd android
call gradlew.bat assembleDebug
if errorlevel 1 (
    echo ERROR: Build failed!
    cd ..
    pause
    exit /b 1
)
cd ..

echo.
echo [5/6] Installing on device H6...
adb -s %DEVICE% install -r android\app\build\outputs\apk\debug\app-debug.apk
if errorlevel 1 (
    echo ERROR: Installation failed!
    pause
    exit /b 1
)
echo ✅ App installed successfully
echo.

:launch
echo [6/6] Launching XitChat on device H6...
adb -s %DEVICE% shell am start -n com.xitchat.app/.MainActivity
if errorlevel 1 (
    echo ERROR: Failed to launch app!
    pause
    exit /b 1
)
echo ✅ App launched
echo.

echo ========================================
echo Testing Setup Complete! 🎉
echo ========================================
echo.
echo Next Steps:
echo 1. Check your device H6 - XitChat should be running
echo 2. Grant all permissions when prompted
echo 3. Open another terminal and run: test-android-logs.bat
echo 4. Follow ANDROID_REALTIME_TESTING.md for test procedures
echo.
echo Press any key to start log monitoring...
pause > nul

echo.
echo Starting log monitor (Press Ctrl+C to stop)...
echo ========================================
adb -s %DEVICE% logcat -s chromium:I *:E | findstr /i "xitchat mesh nostr wifi bluetooth webrtc"

pause
