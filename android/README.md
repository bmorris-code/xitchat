# XitChat Android Native App

This directory contains the native Android application for XitChat, built with Capacitor.

## 📱 What's Inside

### Custom Native Plugins
- **BluetoothMeshPlugin.java** - Bluetooth Low Energy mesh networking
- **WiFiDirectPlugin.java** - WiFi Direct peer-to-peer connections
- **MainActivity.java** - Main activity with plugin registration

### Key Files
- `app/build.gradle` - App-level build configuration with signing
- `build.gradle` - Project-level build configuration
- `app/proguard-rules.pro` - ProGuard rules for release builds
- `app/src/main/AndroidManifest.xml` - App permissions and configuration

## 🚀 Quick Start

### Prerequisites
- Android Studio Arctic Fox or newer
- Android SDK 26+ (Android 8.0+)
- JDK 11 or newer

### Open in Android Studio
1. Open Android Studio
2. File → Open
3. Select this `android` folder
4. Wait for Gradle sync
5. Click Run ▶️

### Build from Command Line

**Debug APK:**
```bash
./gradlew assembleDebug
```

**Release APK:**
```bash
./gradlew assembleRelease
```

**Release AAB (for Play Store):**
```bash
./gradlew bundleRelease
```

## 🔑 Release Signing

### Create Keystore
```bash
keytool -genkey -v -keystore xitchat-release-key.keystore -alias xitchat -keyalg RSA -keysize 2048 -validity 10000
```

### Create keystore.properties
Create `keystore.properties` in this directory:
```properties
storePassword=YOUR_PASSWORD
keyPassword=YOUR_PASSWORD
keyAlias=xitchat
storeFile=xitchat-release-key.keystore
```

**⚠️ IMPORTANT:** Never commit `keystore.properties` or `*.keystore` files!

## 📦 Build Outputs

### Debug
- APK: `app/build/outputs/apk/debug/app-debug.apk`

### Release
- APK: `app/build/outputs/apk/release/app-release.apk`
- AAB: `app/build/outputs/bundle/release/app-release.aab`

## 🔧 Gradle Tasks

```bash
# Clean build
./gradlew clean

# Build debug
./gradlew assembleDebug

# Build release
./gradlew assembleRelease

# Build AAB
./gradlew bundleRelease

# Install on device
./gradlew installDebug

# Run tests
./gradlew test

# Check dependencies
./gradlew dependencies
```

## 📱 Testing

### Install APK via ADB
```bash
adb install app/build/outputs/apk/debug/app-debug.apk
```

### View Logs
```bash
adb logcat | grep XitChat
```

### Uninstall
```bash
adb uninstall com.xitchat.app
```

## 🔍 Debugging

### Enable Debug Mode
1. Settings → About Phone
2. Tap "Build Number" 7 times
3. Settings → Developer Options
4. Enable "USB Debugging"

### Connect Device
```bash
adb devices
```

### View Crash Logs
```bash
adb logcat *:E
```

## 📋 Permissions

The app requires these permissions (see AndroidManifest.xml):
- **Bluetooth** - For mesh networking
- **Location** - For geohash channels and Bluetooth scanning
- **Camera** - For QR codes and photos
- **Storage** - For media files
- **Notifications** - For message alerts
- **Internet** - For Nostr and optional features

## 🏗️ Project Structure

```
android/
├── app/
│   ├── src/
│   │   ├── main/
│   │   │   ├── java/com/xitchat/app/
│   │   │   │   ├── MainActivity.java
│   │   │   │   ├── BluetoothMeshPlugin.java
│   │   │   │   └── WiFiDirectPlugin.java
│   │   │   ├── res/
│   │   │   │   ├── drawable/
│   │   │   │   ├── mipmap/
│   │   │   │   ├── values/
│   │   │   │   └── xml/
│   │   │   └── AndroidManifest.xml
│   │   └── androidTest/
│   ├── build.gradle
│   └── proguard-rules.pro
├── build.gradle
├── settings.gradle
├── variables.gradle
└── gradle.properties
```

## 🔄 Sync with Web App

After making changes to the web app:
```bash
# From project root
npm run build:mobile
npx cap sync android
```

This copies the latest web assets to the Android app.

## 🐛 Common Issues

### Gradle Sync Failed
**Solution:** File → Invalidate Caches → Restart

### Build Failed
**Solution:** 
```bash
./gradlew clean
./gradlew build --refresh-dependencies
```

### Plugin Not Found
**Solution:** Check MainActivity.java has `registerPlugin()` calls

### Permissions Denied
**Solution:** Check AndroidManifest.xml and request at runtime

## 📚 Resources

- [Capacitor Android Docs](https://capacitorjs.com/docs/android)
- [Android Developer Guide](https://developer.android.com/)
- [Gradle User Guide](https://docs.gradle.org/)

## 🆘 Need Help?

See the main project documentation:
- `../ANDROID_QUICK_START.md` - Quick start guide
- `../ANDROID_RELEASE_GUIDE.md` - Release build guide
- `../ANDROID_DEPLOYMENT_CHECKLIST.md` - Full deployment checklist

---

**Built with Capacitor 6.0 for Android 8.0+**
