@echo off
REM XitChat Android Build Script for Windows
REM This script automates the build process for Android APK/AAB

echo.
echo ========================================
echo   XitChat Android Build Script
echo ========================================
echo.

REM Check if we're in the right directory
if not exist "package.json" (
    echo [ERROR] package.json not found. Please run this script from the project root.
    exit /b 1
)

echo [OK] Project directory verified
echo.

REM Step 1: Clean previous builds
echo ========================================
echo Step 1: Cleaning previous builds...
echo ========================================
if exist "dist" rmdir /s /q "dist"
if exist "android\app\build" rmdir /s /q "android\app\build"
echo [OK] Cleaned previous builds
echo.

REM Step 2: Install dependencies
echo ========================================
echo Step 2: Installing dependencies...
echo ========================================
call npm ci
if errorlevel 1 (
    echo [WARNING] npm ci failed, trying npm install...
    call npm install
)
echo [OK] Dependencies installed
echo.

REM Step 3: Build web assets
echo ========================================
echo Step 3: Building web assets for mobile...
echo ========================================
call npm run build:mobile
if errorlevel 1 (
    echo [ERROR] Failed to build web assets
    exit /b 1
)
echo [OK] Web assets built successfully
echo.

REM Step 4: Sync with Capacitor
echo ========================================
echo Step 4: Syncing with Capacitor...
echo ========================================
call npx cap sync android
if errorlevel 1 (
    echo [ERROR] Failed to sync with Capacitor
    exit /b 1
)
echo [OK] Capacitor sync completed
echo.

REM Step 5: Check for keystore
echo ========================================
echo Step 5: Checking for release keystore...
echo ========================================
if exist "android\keystore.properties" (
    echo [OK] Keystore configuration found
    set BUILD_TYPE=release
) else (
    echo [WARNING] No keystore found. Building debug APK instead.
    echo [WARNING] For release builds, create android\keystore.properties
    set BUILD_TYPE=debug
)
echo.

REM Step 6: Build APK/AAB
echo ========================================
echo Step 6: Building Android %BUILD_TYPE%...
echo ========================================

cd android

if "%BUILD_TYPE%"=="release" (
    echo.
    echo What would you like to build?
    echo 1^) APK ^(for direct distribution/testing^)
    echo 2^) AAB ^(for Google Play Store^)
    echo 3^) Both
    echo.
    set /p choice="Enter choice (1-3): "
    
    if "!choice!"=="1" (
        echo Building release APK...
        call gradlew.bat assembleRelease
        if errorlevel 1 (
            echo [ERROR] Failed to build release APK
            cd ..
            exit /b 1
        )
        echo.
        echo [OK] Release APK built successfully!
        call node scripts\sync-public-apk.cjs
        echo.
        echo APK Location:
        echo   android\app\build\outputs\apk\release\app-release.apk
    ) else if "!choice!"=="2" (
        echo Building release AAB...
        call gradlew.bat bundleRelease
        if errorlevel 1 (
            echo [ERROR] Failed to build release AAB
            cd ..
            exit /b 1
        )
        echo.
        echo [OK] Release AAB built successfully!
        echo.
        echo AAB Location:
        echo   android\app\build\outputs\bundle\release\app-release.aab
    ) else if "!choice!"=="3" (
        echo Building both APK and AAB...
        call gradlew.bat assembleRelease bundleRelease
        if errorlevel 1 (
            echo [ERROR] Failed to build release packages
            cd ..
            exit /b 1
        )
        echo.
        echo [OK] Both APK and AAB built successfully!
        call node scripts\sync-public-apk.cjs
        echo.
        echo Build Outputs:
        echo   APK: android\app\build\outputs\apk\release\app-release.apk
        echo   AAB: android\app\build\outputs\bundle\release\app-release.aab
    ) else (
        echo [ERROR] Invalid choice
        cd ..
        exit /b 1
    )
) else (
    echo Building debug APK...
    call gradlew.bat assembleDebug
    if errorlevel 1 (
        echo [ERROR] Failed to build debug APK
        cd ..
        exit /b 1
    )
    echo.
    echo [OK] Debug APK built successfully!
    call node scripts\sync-public-apk.cjs
    echo.
    echo APK Location:
    echo   android\app\build\outputs\apk\debug\app-debug.apk
)

cd ..

REM Step 7: Show file sizes
echo.
echo ========================================
echo Build Statistics:
echo ========================================
if "%BUILD_TYPE%"=="release" (
    if exist "android\app\build\outputs\apk\release\app-release.apk" (
        for %%A in ("android\app\build\outputs\apk\release\app-release.apk") do echo APK Size: %%~zA bytes
    )
    if exist "android\app\build\outputs\bundle\release\app-release.aab" (
        for %%A in ("android\app\build\outputs\bundle\release\app-release.aab") do echo AAB Size: %%~zA bytes
    )
) else (
    if exist "android\app\build\outputs\apk\debug\app-debug.apk" (
        for %%A in ("android\app\build\outputs\apk\debug\app-debug.apk") do echo APK Size: %%~zA bytes
    )
)

REM Step 8: Next steps
echo.
echo ========================================
echo Build Complete!
echo ========================================
echo.
echo Next Steps:
if "%BUILD_TYPE%"=="release" (
    echo   1. Test the APK on a real device
    echo   2. Verify all features work correctly
    echo   3. Upload AAB to Google Play Console
    echo   4. Complete store listing with screenshots
    echo   5. Submit for review
) else (
    echo   1. Install debug APK on device for testing
    echo   2. Create release keystore when ready for production
    echo   3. See ANDROID_RELEASE_GUIDE.md for release instructions
)

echo.
echo Happy deploying!
echo.
pause
