# XitChat Native App Development

This guide covers the native app capabilities added to XitChat using Capacitor.

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- Android Studio (for Android development)
- Xcode (for iOS development, macOS only)
- Capacitor CLI

### Build for Native

**Windows:**
```bash
scripts\build-native.bat
```

**macOS/Linux:**
```bash
chmod +x scripts/build-native.sh
./scripts/build-native.sh
```

### Manual Build Steps

1. **Build web app:**
   ```bash
   npm run build
   ```

2. **Add platforms (first time only):**
   ```bash
   npx cap add ios
   npx cap add android
   ```

3. **Sync assets:**
   ```bash
   npx cap sync
   ```

4. **Open in IDE:**
   ```bash
   npx cap open ios    # Opens Xcode
   npx cap open android # Opens Android Studio
   ```

5. **Run on device/simulator:**
   ```bash
   npx cap run ios
   npx cap run android
   ```

## 📱 Native Features

### Camera Integration
- Native camera access for photo capture
- Fallback to web camera on non-native platforms
- Image preview and processing

### Enhanced Geolocation
- High-precision GPS on mobile devices
- Background location tracking
- Fallback to browser geolocation

### Push Notifications
- Native push notification support
- In-app notification display
- Permission handling

### Haptic Feedback
- Device vibration patterns
- Impact feedback for interactions
- Enhanced user experience

### Mesh Node Scanning
- Bluetooth LE scanning for nearby nodes
- Device-to-device discovery
- Enhanced mesh networking capabilities

## 🔧 Configuration

### Permissions

The app requests these native permissions:
- **Camera:** Photo capture for chat and profile
- **Location:** Geolocation for mesh positioning
- **Notifications:** Push notifications for messages
- **Bluetooth:** Mesh node discovery (future enhancement)

### Platform-Specific Settings

#### Android
- Target SDK: 34 (Android 14)
- Min SDK: 21 (Android 5.0)
- Permissions in `android/app/src/main/AndroidManifest.xml`

#### iOS
- Target iOS: 15.0+
- Permissions in `ios/App/App/Info.plist`
- Background modes configured for mesh networking

## 🛠 Development Workflow

### Making Changes
1. Update web code as usual
2. Run `npm run build`
3. Run `npx cap sync` to update native platforms
4. Test in native IDE

### Debugging
- Use browser dev tools for web debugging
- Use Xcode debugger for iOS
- Use Android Studio Logcat for Android
- Capacitor logs: `npx cap run android --livereload --external`

### Adding New Native Plugins
```bash
npm install @capacitor/plugin-name
npx cap sync
```

## 📂 File Structure

```
├── services/
│   └── nativeDevice.ts      # Native device integration service
├── components/
│   └── NativeFeaturesView.tsx # Native features UI
├── scripts/
│   ├── build-native.sh       # Build script for macOS/Linux
│   └── build-native.bat     # Build script for Windows
├── capacitor.config.ts      # Capacitor configuration
├── ios/                     # iOS project (generated)
└── android/                 # Android project (generated)
```

## 🔍 Testing Native Features

### Web Testing
- Native features gracefully fallback to web equivalents
- Test in browser for basic functionality

### Device Testing
- Test on real devices for full native capabilities
- Use simulators/emulators for basic testing
- Bluetooth features require physical devices

## 🚀 Deployment

### App Store (iOS)
1. Build in Xcode
2. Archive and upload to App Store Connect
3. Configure app metadata and screenshots

### Google Play (Android)
1. Build signed APK/AAB in Android Studio
2. Upload to Google Play Console
3. Configure store listing and permissions

## 🔮 Future Enhancements

- **Bluetooth LE Plugin:** Custom plugin for advanced mesh networking
- **Background Sync:** Enhanced background mesh operations
- **Local Authentication:** Biometric security
- **File System Access:** Local file management
- **Share Extension:** Native sharing integration

## 🐛 Troubleshooting

### Common Issues

**Build fails:**
- Check Node.js version compatibility
- Clear Capacitor cache: `npx cap clean`
- Rebuild: `npm run build && npx cap sync`

**Permissions not working:**
- Check platform-specific permission files
- Ensure permissions are requested at runtime
- Verify platform capability support

**Camera not working:**
- Check camera permissions in device settings
- Ensure HTTPS scheme in Capacitor config
- Test on physical device (emulators may have limited camera support)

**Push notifications not received:**
- Verify Firebase/APNS configuration
- Check device notification settings
- Ensure app has background permissions

### Getting Help

- Check [Capacitor Documentation](https://capacitorjs.com/docs)
- Review [Ionic Forums](https://forum.ionicframework.com/)
- Check GitHub issues for known problems

---

**Note:** The web app remains fully functional without native capabilities. Native features enhance the experience but don't replace core functionality.
