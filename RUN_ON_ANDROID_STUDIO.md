# 🚀 Running XitChat on Android Studio

## ✅ Quick Steps to Run on Android Phone/Emulator

### Method 1: Using Android Studio (EASIEST - Recommended!)

Since you already have Android Studio open:

#### Step 1: Make Sure Android Project is Open
The Android Studio should already be showing your XitChat Android project.

#### Step 2: Select Your Device
At the top of Android Studio, you'll see a device dropdown:
- Click the dropdown next to the ▶️ Run button
- You should see:
  - **emulator-5554** (your current emulator)
  - Any connected physical Android phones

#### Step 3: Click Run ▶️
- Click the green **Run** button (▶️) at the top
- Or press **Shift + F10**
- Android Studio will:
  1. Build the app
  2. Install it on your device
  3. Launch it automatically

**That's it! The app will open on your device!** 🎉

---

### Method 2: Connect a Real Android Phone

If you want to test on a real phone instead of the emulator:

#### Step 1: Enable Developer Mode on Your Phone
1. Go to **Settings** → **About Phone**
2. Tap **Build Number** 7 times
3. You'll see "You are now a developer!"

#### Step 2: Enable USB Debugging
1. Go to **Settings** → **Developer Options**
2. Enable **USB Debugging**
3. Connect phone to computer via USB cable

#### Step 3: Verify Connection
```bash
adb devices
```
You should see your phone listed.

#### Step 4: Run from Android Studio
1. In Android Studio, click the device dropdown
2. Select your phone (it will show the phone model)
3. Click **Run** ▶️

---

### Method 3: Build and Install Manually

If you prefer command line:

#### Build the APK
```bash
# From project root
cd android
gradlew.bat assembleDebug
```

#### Install on Connected Device
```bash
# Go back to project root
cd ..

# Install
adb install -r android\app\build\outputs\apk\debug\app-debug.apk
```

#### Launch the App
```bash
adb shell am start -n com.xitchat.app/.MainActivity
```

---

## 🔍 Troubleshooting

### Issue: "No devices found"
**Solution:**
- Make sure USB debugging is enabled
- Try a different USB cable
- Check if phone is in "File Transfer" mode (not "Charge only")
- Run: `adb kill-server` then `adb start-server`

### Issue: "App crashes on startup"
**Solution:**
1. Check Android Studio Logcat (bottom panel)
2. Look for red error messages
3. Common fixes:
   - Clean and rebuild: **Build** → **Clean Project** → **Rebuild Project**
   - Invalidate caches: **File** → **Invalidate Caches** → **Restart**


### Issue: "Build failed"
**Solution:**
1. Make sure you ran `npx cap sync android` first
2. In Android Studio: **File** → **Sync Project with Gradle Files**
3. Check for any red errors in the code

### Issue: "Permissions denied"
**Solution:**
- When app launches, it will ask for permissions
- Grant all permissions (Bluetooth, Location, Camera, etc.)
- If you denied them, go to phone Settings → Apps → XitChat → Permissions

---

## 📱 Testing Checklist

Once the app is running:

### Basic Functionality
- [ ] App launches without crashing
- [ ] Can see the boot sequence
- [ ] Can create/edit profile
- [ ] Can navigate between screens (Chats, Rooms, Buzz, Map, Games)

### Permissions
- [ ] Bluetooth permission granted
- [ ] Location permission granted
- [ ] Camera permission granted (try taking a photo)
- [ ] Notifications enabled

### Features
- [ ] Can send messages
- [ ] Can join rooms
- [ ] Can view Buzz feed
- [ ] Games work (try Snake or Tetris)
- [ ] Map/Radar shows

### Mesh Networking (Advanced)
- [ ] Check Logcat for "Bluetooth mesh initialized"
- [ ] Check for "WiFi Direct initialized"
- [ ] Try discovering nearby peers (if you have another device)

---

## 📊 View Logs in Android Studio

### Open Logcat
1. Click **Logcat** tab at the bottom of Android Studio
2. In the filter, type: `XitChat`
3. You'll see all app logs

### Useful Log Filters
- `tag:XitChat` - All XitChat logs
- `level:error` - Only errors
- `level:warn` - Warnings and errors

---

## 🎮 Current Device Status

Based on your system:
- ✅ **Emulator Running:** emulator-5554
- ✅ **Android Studio:** Open
- ✅ **Project:** Synced

**You're ready to click Run! ▶️**

---

## 🚀 Quick Command Reference

```bash
# Check connected devices
adb devices

# Install APK
adb install -r android\app\build\outputs\apk\debug\app-debug.apk

# Launch app
adb shell am start -n com.xitchat.app/.MainActivity

# View logs
adb logcat | findstr XitChat

# Uninstall app
adb uninstall com.xitchat.app

# Clear app data
adb shell pm clear com.xitchat.app

# Take screenshot
adb shell screencap -p /sdcard/screenshot.png
adb pull /sdcard/screenshot.png
```

---

## 💡 Pro Tips

### Faster Development
1. Enable **Instant Run** in Android Studio for faster rebuilds
2. Use **Hot Reload** when changing UI
3. Keep Logcat open to see real-time logs

### Testing on Multiple Devices
1. You can run on emulator AND real phone simultaneously
2. Test mesh networking by running on 2 devices
3. They should discover each other via Bluetooth/WiFi Direct

### Performance Testing
1. Use Android Studio Profiler (View → Tool Windows → Profiler)
2. Monitor CPU, Memory, Network usage
3. Check for memory leaks

---

## ✅ Next Steps After Running

Once the app is running successfully:

1. **Test all features** - Go through each screen
2. **Grant all permissions** - Bluetooth, Location, Camera, etc.
3. **Check logs** - Make sure no errors in Logcat
4. **Test mesh networking** - If you have 2 devices
5. **Take screenshots** - For Play Store listing
6. **Note any bugs** - Fix before release

---

## 🎉 You're All Set!

**Just click the Run button (▶️) in Android Studio and your app will launch!**

The easiest way is definitely using Android Studio's Run button - it handles everything automatically.

---

**Need help? Check the logs in Logcat or see ANDROID_QUICK_START.md for more troubleshooting tips.**
