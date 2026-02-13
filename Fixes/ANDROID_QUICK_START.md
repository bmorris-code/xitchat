# XitChat Android - Quick Start Guide

## 🚀 Build Your First APK in 5 Minutes

### Prerequisites
- ✅ Node.js installed
- ✅ Android Studio installed (with Android SDK)
- ✅ Project already set up (you're here!)

### Step 1: Build Web Assets
```bash
npm run build:mobile
```
This compiles your React app for mobile deployment.

### Step 2: Sync with Android
```bash
npx cap sync android
```
This copies web assets to Android project and updates native plugins.

### Step 3: Build APK

**Option A: Using Build Script (Easiest)**
```bash
# Windows
build-android.bat

# Mac/Linux
chmod +x build-android.sh
./build-android.sh
```

**Option B: Manual Build**
```bash
cd android
./gradlew assembleDebug    # Windows: gradlew.bat assembleDebug
```

### Step 4: Install on Device

**Via Android Studio:**
1. Open `android` folder in Android Studio
2. Click Run ▶️
3. Select your device

**Via ADB:**
```bash
adb install android/app/build/outputs/apk/debug/app-debug.apk
```

**Via File Transfer:**
1. Copy APK to your phone
2. Open file manager
3. Tap APK to install
4. Allow "Install from unknown sources" if prompted

---

## 🧪 Testing Checklist

### Basic Functionality
- [ ] App launches without crashing
- [ ] Can create profile (handle, avatar)
- [ ] Can send messages
- [ ] Can join rooms
- [ ] Can view buzz feed
- [ ] Games work

### Permissions
- [ ] Bluetooth permission granted
- [ ] Location permission granted
- [ ] Camera permission granted
- [ ] Notifications permission granted

### Mesh Networking
- [ ] Bluetooth mesh initializes
- [ ] WiFi Direct initializes
- [ ] Can discover nearby peers
- [ ] Can send/receive messages

### Performance
- [ ] App starts in < 3 seconds
- [ ] UI is responsive
- [ ] No lag when scrolling
- [ ] Battery usage reasonable

---

## 🔧 Common Issues & Quick Fixes

### Issue: "Build failed"
**Fix:** Clean and rebuild
```bash
cd android
./gradlew clean
./gradlew assembleDebug
```

### Issue: "App crashes on startup"
**Fix:** Check Android Studio Logcat for errors
```bash
adb logcat | grep XitChat
```

### Issue: "Bluetooth not working"
**Fix:** 
1. Check AndroidManifest.xml has Bluetooth permissions
2. Grant permissions in app settings
3. Enable Bluetooth on device

### Issue: "Cannot install APK"
**Fix:**
1. Enable "Install from unknown sources" in Settings
2. Uninstall old version first
3. Check APK is not corrupted

---

## 📱 Testing on Real Device

### Enable Developer Mode
1. Go to Settings → About Phone
2. Tap "Build Number" 7 times
3. Go back → Developer Options
4. Enable "USB Debugging"

### Connect Device
```bash
# Check device is connected
adb devices

# Should show:
# List of devices attached
# ABC123XYZ    device
```

### Install & Run
```bash
# Install APK
adb install -r android/app/build/outputs/apk/debug/app-debug.apk

# Launch app
adb shell am start -n com.xitchat.app/.MainActivity

# View logs
adb logcat | grep -i xitchat
```

---

## 🎯 Next Steps

### For Testing
1. Build debug APK (done above)
2. Test all features
3. Fix any bugs
4. Repeat

### For Release
1. Create keystore (see ANDROID_RELEASE_GUIDE.md)
2. Build release APK/AAB
3. Test release build thoroughly
4. Submit to Google Play Store

---

## 📚 Additional Resources

- **Full Release Guide:** ANDROID_RELEASE_GUIDE.md
- **Deployment Checklist:** ANDROID_DEPLOYMENT_CHECKLIST.md
- **Play Store Listing:** PLAY_STORE_LISTING.md
- **Native Plugins:** services/nativeAndroidPlugins.ts

---

## 🆘 Need Help?

### Check Logs
```bash
# Android logs
adb logcat

# Filter for errors
adb logcat *:E

# Filter for XitChat
adb logcat | grep XitChat
```

### Debug in Android Studio
1. Open `android` folder
2. Click Debug 🐛
3. Set breakpoints
4. Inspect variables

### Common Commands
```bash
# List connected devices
adb devices

# Uninstall app
adb uninstall com.xitchat.app

# Clear app data
adb shell pm clear com.xitchat.app

# Take screenshot
adb shell screencap -p /sdcard/screenshot.png
adb pull /sdcard/screenshot.png

# Record screen
adb shell screenrecord /sdcard/demo.mp4
# (Ctrl+C to stop)
adb pull /sdcard/demo.mp4
```

---

**Happy Building! 🎉**

*Remember: Debug builds are for testing. Use release builds for distribution.*
