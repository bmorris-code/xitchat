# XitChat Android Deployment - Complete Checklist

## 🎯 Pre-Build Checklist

### Code & Features
- [ ] All features tested in development
- [ ] No console errors in production build
- [ ] All TypeScript errors resolved
- [ ] Native plugins registered in MainActivity
- [ ] Permissions properly declared in AndroidManifest.xml
- [ ] ProGuard rules configured
- [ ] Version code and name updated in build.gradle

### Testing
- [ ] Tested on Android 8.0 (minimum SDK)
- [ ] Tested on Android 13+ (latest features)
- [ ] Tested on different screen sizes (phone, tablet)
- [ ] Tested Bluetooth mesh connectivity
- [ ] Tested WiFi Direct connectivity
- [ ] Tested offline functionality
- [ ] Tested all permissions (Camera, Location, Bluetooth, etc.)
- [ ] Battery usage acceptable (< 5% per hour idle)
- [ ] Memory usage acceptable (< 200 MB)
- [ ] App size acceptable (< 50 MB)

### Security
- [ ] Keystore created and secured
- [ ] keystore.properties added to .gitignore
- [ ] No API keys hardcoded in source
- [ ] All sensitive data encrypted
- [ ] HTTPS used for all network requests
- [ ] Privacy policy published and linked

## 🔑 Keystore Setup

### Step 1: Generate Keystore
```bash
cd android
keytool -genkey -v -keystore xitchat-release-key.keystore -alias xitchat -keyalg RSA -keysize 2048 -validity 10000
```

**Save these securely:**
- Keystore password: _______________
- Key password: _______________
- Keystore location: android/xitchat-release-key.keystore

### Step 2: Create keystore.properties
Create `android/keystore.properties`:
```properties
storePassword=YOUR_KEYSTORE_PASSWORD
keyPassword=YOUR_KEY_PASSWORD
keyAlias=xitchat
storeFile=xitchat-release-key.keystore
```

### Step 3: Backup Keystore
- [ ] Keystore backed up to secure location
- [ ] Passwords stored in password manager
- [ ] Backup verified (can build with it)

## 🏗️ Build Process

### Option 1: Using Build Script (Recommended)
```bash
# Windows
build-android.bat

# Mac/Linux
chmod +x build-android.sh
./build-android.sh
```

### Option 2: Manual Build
```bash
# 1. Clean
npm run build:mobile

# 2. Sync
npx cap sync android

# 3. Build APK
cd android
./gradlew assembleRelease  # or gradlew.bat on Windows

# 4. Build AAB (for Play Store)
./gradlew bundleRelease
```

### Build Outputs
- [ ] APK: `android/app/build/outputs/apk/release/app-release.apk`
- [ ] AAB: `android/app/build/outputs/bundle/release/app-release.aab`

## 📱 Testing Release Build

### Install APK on Device
```bash
# Via ADB
adb install android/app/build/outputs/apk/release/app-release.apk

# Or transfer to device and install manually
```

### Test Checklist
- [ ] App installs successfully
- [ ] App launches without crashes
- [ ] All screens load correctly
- [ ] Bluetooth mesh works
- [ ] WiFi Direct works
- [ ] Messages send/receive
- [ ] Camera works
- [ ] Location works
- [ ] Notifications work
- [ ] No performance issues
- [ ] No memory leaks
- [ ] Battery usage acceptable

## 🎨 Google Play Store Assets

### Required Graphics

#### 1. App Icon (Already have)
- [x] 512x512 PNG
- [x] Transparent or solid background
- [x] Located in: `android/app/src/main/res/mipmap-*/`

#### 2. Feature Graphic (Required)
- [ ] 1024 x 500 PNG
- [ ] No transparency
- [ ] Shows app name and key feature
- [ ] Follows brand guidelines

**Create using:**
```bash
# Use generate_image tool or design in Figma/Canva
```

#### 3. Screenshots (Minimum 2, Maximum 8)
- [ ] Screenshot 1: Chat interface (1080x1920 or 1080x2340)
- [ ] Screenshot 2: Peer radar (1080x1920 or 1080x2340)
- [ ] Screenshot 3: Rooms view
- [ ] Screenshot 4: Buzz feed
- [ ] Screenshot 5: Games
- [ ] Screenshot 6: Profile
- [ ] Screenshot 7: Marketplace
- [ ] Screenshot 8: Network status

**Capture screenshots:**
```bash
# Use Android Studio emulator or real device
# Add device frame for better presentation
```

#### 4. Promo Video (Optional but recommended)
- [ ] 30-120 seconds
- [ ] Shows key features
- [ ] Upload to YouTube
- [ ] Add link to Play Store listing

## 📝 Store Listing Information

### Basic Info
- [x] App name: **XitChat: Mesh Messenger**
- [x] Package name: **com.xitchat.app**
- [ ] Short description (80 chars): See PLAY_STORE_LISTING.md
- [ ] Full description (4000 chars): See PLAY_STORE_LISTING.md
- [ ] Category: **Communication**
- [ ] Tags: mesh, offline, chat, decentralized, p2p, privacy

### Contact Info
- [ ] Developer name: _______________
- [ ] Email: _______________
- [ ] Website: https://xitchat.vercel.app
- [ ] Privacy policy: https://xitchat.vercel.app/privacy-policy.html

### Pricing & Distribution
- [x] Price: **Free**
- [x] In-app purchases: **None**
- [x] Ads: **None**
- [ ] Countries: **Worldwide** (or select specific)

## 🔒 Privacy & Compliance

### Data Safety Questionnaire
- [ ] Complete data safety form in Play Console
- [ ] Declare all permissions used
- [ ] Explain data collection (none for XitChat)
- [ ] Confirm encryption practices

### Content Rating
- [ ] Complete IARC questionnaire
- [ ] Expected rating: **Everyone** or **Teen**
- [ ] No violence, sexual content, or profanity

### Legal
- [x] Privacy policy published
- [ ] Terms of service (if applicable)
- [ ] GDPR compliance (if targeting EU)
- [ ] COPPA compliance (if targeting US children)

## 🚀 Google Play Console Setup

### Account Setup
- [ ] Create Google Play Developer account ($25 one-time fee)
- [ ] Verify email address
- [ ] Complete account details
- [ ] Set up payment profile (for future paid apps)

### Create App
1. [ ] Go to Play Console → All apps → Create app
2. [ ] Enter app details:
   - App name: XitChat
   - Default language: English
   - App or game: App
   - Free or paid: Free
3. [ ] Accept declarations
4. [ ] Create app

### App Dashboard Sections

#### 1. App Content
- [ ] Privacy policy URL
- [ ] App access (all features available to all users)
- [ ] Ads (declare: no ads)
- [ ] Content rating (complete questionnaire)
- [ ] Target audience (13+)
- [ ] News app (No)
- [ ] COVID-19 contact tracing (No)
- [ ] Data safety (complete form)
- [ ] Government app (No)

#### 2. Store Settings
- [ ] App category: Communication
- [ ] Tags: Add relevant tags
- [ ] Store listing contact: Your email

#### 3. Main Store Listing
- [ ] App name
- [ ] Short description
- [ ] Full description
- [ ] App icon (512x512)
- [ ] Feature graphic (1024x500)
- [ ] Phone screenshots (2-8)
- [ ] 7-inch tablet screenshots (optional)
- [ ] 10-inch tablet screenshots (optional)

#### 4. Release
- [ ] Choose release track (Production, Open testing, Closed testing, Internal testing)
- [ ] Upload AAB file
- [ ] Release name: v1.0
- [ ] Release notes: See PLAY_STORE_LISTING.md

#### 5. Countries/Regions
- [ ] Select countries to distribute
- [ ] Recommended: Start with your country, then expand

#### 6. Pricing & Distribution
- [ ] Confirm free app
- [ ] Select countries
- [ ] Confirm content guidelines
- [ ] Confirm export laws

## 📊 Pre-Launch Report

### Google Play Pre-Launch Testing
- [ ] Upload AAB to internal testing track
- [ ] Wait for pre-launch report (automated testing)
- [ ] Review crash reports
- [ ] Review performance metrics
- [ ] Fix any critical issues
- [ ] Re-upload if needed

## 🎯 Launch Checklist

### Final Verification
- [ ] All store listing sections complete (green checkmarks)
- [ ] AAB uploaded and processed
- [ ] Release notes written
- [ ] Screenshots look good
- [ ] Privacy policy accessible
- [ ] All compliance forms completed
- [ ] Pre-launch report reviewed

### Submit for Review
- [ ] Click "Send for review"
- [ ] Wait for approval (usually 1-3 days)
- [ ] Monitor email for updates

### Post-Approval
- [ ] Receive approval email
- [ ] Click "Publish" in Play Console
- [ ] App goes live (usually within hours)
- [ ] Verify app appears in Play Store
- [ ] Test installation from Play Store

## 📈 Post-Launch

### Monitoring
- [ ] Set up Play Console alerts
- [ ] Monitor crash reports daily
- [ ] Monitor user reviews
- [ ] Track install metrics
- [ ] Monitor performance metrics

### User Feedback
- [ ] Respond to user reviews (within 24-48 hours)
- [ ] Create feedback collection system
- [ ] Plan updates based on feedback

### Marketing
- [ ] Share Play Store link on social media
- [ ] Create landing page with download link
- [ ] Submit to app review sites
- [ ] Reach out to tech bloggers
- [ ] Create demo video for YouTube

### Updates
- [ ] Plan regular updates (monthly or bi-weekly)
- [ ] Increment version code for each release
- [ ] Write clear release notes
- [ ] Test updates before publishing

## 🆘 Troubleshooting

### Common Issues

#### "Keystore not found"
**Solution:** Ensure `xitchat-release-key.keystore` is in `android/` directory

#### "Failed to sign APK"
**Solution:** Check `keystore.properties` has correct passwords

#### "Version code must be unique"
**Solution:** Increment `versionCode` in `android/app/build.gradle`

#### "App rejected for policy violation"
**Solution:** Review rejection reason, fix issues, resubmit

#### "App crashes on startup"
**Solution:** Check ProGuard rules, may need to add keep rules

#### "Permissions not working"
**Solution:** Verify permissions in AndroidManifest.xml and request at runtime

## 📞 Support Resources

- **Google Play Console:** https://play.google.com/console
- **Android Developer Docs:** https://developer.android.com/distribute
- **Capacitor Docs:** https://capacitorjs.com/docs/android
- **XitChat Docs:** See ANDROID_RELEASE_GUIDE.md

## ✅ Final Checklist

Before submitting:
- [ ] All features work
- [ ] No crashes
- [ ] Good performance
- [ ] Keystore secured
- [ ] AAB built and tested
- [ ] Store listing complete
- [ ] Graphics uploaded
- [ ] Privacy policy published
- [ ] All compliance forms done
- [ ] Ready to launch! 🚀

---

**Good luck with your launch! 🎉**

*Remember: The first release is just the beginning. Keep improving based on user feedback!*
