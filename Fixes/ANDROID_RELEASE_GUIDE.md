# XitChat Android Release Build Configuration

## Signing Configuration

### Step 1: Generate Release Keystore

Run this command to generate your release keystore:

```bash
keytool -genkey -v -keystore xitchat-release-key.keystore -alias xitchat -keyalg RSA -keysize 2048 -validity 10000
```

**Important Information to Provide:**
- Password: [Choose a strong password and SAVE IT SECURELY]
- First and Last Name: XitChat
- Organizational Unit: Development
- Organization: XitChat
- City: Johannesburg
- State: Gauteng
- Country Code: ZA

### Step 2: Create keystore.properties

Create a file at `android/keystore.properties` with the following content:

```properties
storePassword=YOUR_KEYSTORE_PASSWORD
keyPassword=YOUR_KEY_PASSWORD
keyAlias=xitchat
storeFile=xitchat-release-key.keystore
```

**IMPORTANT:** Add `keystore.properties` to `.gitignore` to keep your credentials secure!

### Step 3: Update app/build.gradle

The signing configuration has been added to `app/build.gradle`. It will automatically use your keystore for release builds.

## Building Release APK/AAB

### Option 1: Build APK (for direct distribution)

```bash
cd android
./gradlew assembleRelease
```

Output: `android/app/build/outputs/apk/release/app-release.apk`

### Option 2: Build AAB (for Google Play Store)

```bash
cd android
./gradlew bundleRelease
```

Output: `android/app/build/outputs/bundle/release/app-release.aab`

## Version Management

Update version in `android/app/build.gradle`:

```gradle
defaultConfig {
    versionCode 1      // Increment this for each release (1, 2, 3, ...)
    versionName "1.0"  // User-facing version (1.0, 1.1, 2.0, ...)
}
```

## Google Play Store Submission Checklist

### 1. App Information
- [x] App Name: XitChat
- [x] Package Name: com.xitchat.app
- [ ] Short Description (80 chars): "Decentralized mesh messaging app for offline communication"
- [ ] Full Description (4000 chars): See PLAY_STORE_DESCRIPTION.md
- [ ] App Category: Communication
- [ ] Content Rating: Everyone

### 2. Graphics Assets Required
- [ ] App Icon: 512x512 PNG (already have in res/mipmap)
- [ ] Feature Graphic: 1024x500 PNG
- [ ] Screenshots: At least 2 (1080x1920 for phone)
- [ ] Promo Video (optional): YouTube link

### 3. Privacy & Legal
- [x] Privacy Policy URL: https://xitchat.vercel.app/privacy-policy.html
- [ ] App Access: Declare all permissions used
- [ ] Data Safety: Complete questionnaire about data collection

### 4. Release Build
- [ ] Signed AAB file
- [ ] Version code and name set
- [ ] ProGuard enabled for code optimization
- [ ] All features tested on real device

### 5. Store Listing Optimization
- [ ] Keywords: mesh, offline, chat, decentralized, p2p, privacy
- [ ] Localization: English (add more languages later)

## Testing Before Release

### Device Testing Checklist
- [ ] Install APK on Android 8.0+ device
- [ ] Test Bluetooth mesh connectivity
- [ ] Test WiFi Direct connectivity
- [ ] Test all permissions (Camera, Location, Bluetooth, etc.)
- [ ] Test offline functionality
- [ ] Test message sending/receiving
- [ ] Test all UI screens
- [ ] Test on different screen sizes
- [ ] Battery usage test (run for 1 hour)
- [ ] Memory leak test

### Performance Targets
- App size: < 50 MB
- Startup time: < 3 seconds
- Memory usage: < 200 MB
- Battery drain: < 5% per hour (idle)

## Common Issues & Solutions

### Issue: "Keystore not found"
**Solution:** Make sure `xitchat-release-key.keystore` is in the `android/` directory

### Issue: "Failed to sign APK"
**Solution:** Check that `keystore.properties` has correct passwords

### Issue: "Version code must be unique"
**Solution:** Increment `versionCode` in `build.gradle`

### Issue: "App crashes on startup"
**Solution:** Check ProGuard rules, may need to add keep rules for certain classes

## ProGuard Rules

The following ProGuard rules are included for release builds:

- Keep Capacitor classes
- Keep native plugin classes
- Keep Bluetooth and WiFi Direct classes
- Optimize and obfuscate other code

## Next Steps After Building

1. Test the release APK thoroughly on multiple devices
2. Create Google Play Console account (one-time $25 fee)
3. Upload AAB to Play Console
4. Complete store listing with graphics
5. Submit for review (usually takes 1-3 days)
6. Once approved, publish to production!

## Support & Resources

- Google Play Console: https://play.google.com/console
- Android Developer Guide: https://developer.android.com/distribute
- Capacitor Android Guide: https://capacitorjs.com/docs/android
