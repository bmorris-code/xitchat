# 🚀 XitChat Android H6 - Quick Testing Reference

## 📱 Device Info
- **Model:** H6
- **Device ID:** `1MA75199ZA1G80B1P1X0407`
- **App Status:** ✅ Installed
- **Package:** `com.xitchat.app`

---

## ⚡ Quick Start (3 Steps)

### 1️⃣ Launch the App
```bash
# Run this in terminal:
test-android-h6.bat
```
**OR manually:**
```bash
adb -s 1MA75199ZA1G80B1P1X0407 shell am start -n com.xitchat.app/.MainActivity
```

### 2️⃣ Monitor Logs
```bash
# Open a second terminal and run:
test-android-logs.bat
```

### 3️⃣ Open Test Companion
- Open `test-companion.html` in your browser
- Click "Initialize Test Environment"
- Start testing!

---

## 🧪 Quick Tests

### Test 1: Basic Launch (30 seconds)
1. ✅ Launch app on device H6
2. ✅ Check for crash (should stay open)
3. ✅ Grant all permissions when prompted
4. ✅ Check logs for "initialized" messages

**Expected Logs:**
```
✅ Serverless WiFi P2P initialized
✅ Bluetooth mesh initialized
✅ Nostr service connected
✅ Presence beacon started
```

### Test 2: Peer Discovery (2 minutes)
1. ✅ Open test-companion.html in browser
2. ✅ Click "Initialize Test Environment"
3. ✅ Wait 10-20 seconds
4. ✅ Check if Android H6 appears in browser peers
5. ✅ Check if browser appears in Android H6 radar

**Expected:**
- Browser shows "Android H6" in peer list
- Android shows browser peer in radar
- Connection type: WebRTC or Nostr

### Test 3: Send Message (1 minute)
1. ✅ In test-companion.html, type message
2. ✅ Click "Send Custom Message"
3. ✅ Check Android H6 - message should appear
4. ✅ Reply from Android H6
5. ✅ Check browser - reply should appear

**Expected:**
- Message delivery < 2 seconds
- No errors in logs
- Messages appear in both devices

### Test 4: Room Chat (2 minutes)
1. ✅ On Android H6: Create room "Test Room 1"
2. ✅ On Browser: Join "Test Room 1"
3. ✅ Send message from Android
4. ✅ Send message from Browser
5. ✅ Both should see all messages

**Expected:**
- Room appears on both devices
- All messages visible to all participants
- Real-time updates

---

## 🔧 Troubleshooting Commands

### Check if app is running
```bash
adb -s 1MA75199ZA1G80B1P1X0407 shell dumpsys activity | findstr xitchat
```

### Restart app
```bash
adb -s 1MA75199ZA1G80B1P1X0407 shell am force-stop com.xitchat.app
adb -s 1MA75199ZA1G80B1P1X0407 shell am start -n com.xitchat.app/.MainActivity
```

### Clear app data (fresh start)
```bash
adb -s 1MA75199ZA1G80B1P1X0407 shell pm clear com.xitchat.app
```

### Take screenshot
```bash
adb -s 1MA75199ZA1G80B1P1X0407 shell screencap -p /sdcard/screenshot.png
adb -s 1MA75199ZA1G80B1P1X0407 pull /sdcard/screenshot.png
```

### View real-time logs
```bash
adb -s 1MA75199ZA1G80B1P1X0407 logcat -s chromium:I *:E
```

---

## 📊 What to Look For

### ✅ Success Indicators
- App launches without crashing
- Logs show "initialized" for all services
- Peers appear in radar within 20 seconds
- Messages deliver within 2 seconds
- No red errors in logs

### ❌ Failure Indicators
- App crashes on launch
- "Failed to initialize" errors
- No peers discovered after 30 seconds
- Messages not delivered
- Continuous errors in logs

---

## 🎯 Testing Checklist

### Basic Functionality
- [ ] App launches successfully
- [ ] No crashes during 5-minute session
- [ ] All permissions granted
- [ ] Can navigate between screens

### Network Layers
- [ ] WiFi P2P initialized
- [ ] Bluetooth initialized
- [ ] Nostr connected
- [ ] WebRTC available
- [ ] Presence beacon active

### Peer Discovery
- [ ] Browser peer discovered
- [ ] Android peer discovered
- [ ] Discovery time < 20 seconds
- [ ] Peer info displayed correctly

### Messaging
- [ ] Browser → Android works
- [ ] Android → Browser works
- [ ] Message latency < 2 seconds
- [ ] No message loss
- [ ] No duplicate messages

### Rooms
- [ ] Can create room
- [ ] Can join room
- [ ] Room messages work
- [ ] Multiple participants work

---

## 📞 Remote Debugging

### Chrome DevTools for Android
1. Open Chrome on computer
2. Go to: `chrome://inspect`
3. Find device H6
4. Click "Inspect" next to XitChat
5. Use full Chrome DevTools!

### Useful Console Commands
```javascript
// Check peers
realtimeRadar.getPeers()

// Check network status
networkStateManager.getStatus()

// Check Nostr
nostrService.isConnected()

// Force presence update
presenceBeacon.announcePresence()
```

---

## 📝 Report Template

```markdown
## Test Session: [Date/Time]

### Device
- Model: H6
- Android Version: [Check in settings]
- App Version: [Check in app]

### Results
✅ / ❌ App Launch
✅ / ❌ Network Init
✅ / ❌ Peer Discovery
✅ / ❌ Messaging
✅ / ❌ Rooms

### Issues Found
1. [Description]
2. [Description]

### Performance
- Peer discovery: ___ seconds
- Message latency: ___ ms
- Battery usage: ___% per hour

### Notes
[Additional observations]
```

---

## 🎉 Next Steps

After successful testing:
1. ✅ Document all working features
2. ✅ Note any issues or bugs
3. ✅ Take screenshots/videos
4. ✅ Test with multiple devices (if available)
5. ✅ Prepare for production deployment

---

**Need Help?**
- Check logs first: `test-android-logs.bat`
- See full guide: `ANDROID_REALTIME_TESTING.md`
- Use test companion: `test-companion.html`
