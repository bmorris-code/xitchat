# 📱 XitChat Android Real-Time Testing Guide - Device H6

**Device ID:** `1MA75199ZA1G80B1P1X0407`  
**Test Date:** February 13, 2026  
**Objective:** Test real-time connections, chats, and rooms on physical Android device

---

## 🎯 Testing Overview

This guide will help you test the following real-time features on your Android device:

1. **Network Layer Initialization** - Verify all 5 mesh layers start correctly
2. **Peer Discovery** - Test radar and presence beacon
3. **Real-Time Chat** - Send/receive messages via different transports
4. **Room Functionality** - Join rooms and test group messaging
5. **Connection Switching** - Verify automatic transport selection

---

## 📋 Pre-Test Checklist

### ✅ Device Setup
- [x] Android device H6 connected via USB
- [ ] USB Debugging enabled
- [ ] Developer mode active
- [ ] All permissions granted (Bluetooth, Location, Camera, Notifications)
- [ ] WiFi enabled
- [ ] Bluetooth enabled
- [ ] Location services enabled

### ✅ Build Status
- [ ] Latest code synced to Android project
- [ ] App built successfully
- [ ] App installed on device
- [ ] App launches without crashes

---

## 🚀 Step 1: Build and Deploy to Device

### Option A: Using Android Studio (Recommended)
1. Open Android Studio with XitChat project
2. Select device `1MA75199ZA1G80B1P1X0407` from device dropdown
3. Click **Run** ▶️ button
4. Wait for build and installation
5. App should launch automatically

### Option B: Using Command Line
```bash
# 1. Sync Capacitor
npx cap sync android

# 2. Build the app
cd android
gradlew.bat assembleDebug
cd ..

# 3. Install on device
adb -s 1MA75199ZA1G80B1P1X0407 install -r android\app\build\outputs\apk\debug\app-debug.apk

# 4. Launch the app
adb -s 1MA75199ZA1G80B1P1X0407 shell am start -n com.xitchat.app/.MainActivity
```

---

## 🔍 Step 2: Monitor Logs in Real-Time

Open a separate terminal to monitor logs:

```bash
# Filter for XitChat-specific logs
adb -s 1MA75199ZA1G80B1P1X0407 logcat | findstr "XitChat"

# Or monitor all console logs
adb -s 1MA75199ZA1G80B1P1X0407 logcat -s chromium:I
```

**What to look for:**
- ✅ `📡 Initializing SERVERLESS WiFi P2P...`
- ✅ `🔵 Bluetooth mesh initialized`
- ✅ `📡 Nostr service initialized`
- ✅ `🗼 Initializing SERVERLESS Mobile Mesh Radar...`
- ✅ `📡 Presence beacon started`

---

## 🧪 Step 3: Test Network Layer Initialization

### Test 3.1: Verify All Layers Start
1. Launch the app on device H6
2. Watch the boot sequence
3. Check logs for initialization messages

**Expected Results:**
```
✅ Serverless WiFi P2P (WebRTC + Nostr signaling) initialized
✅ Bluetooth mesh initialized
✅ Nostr service connected to relays
✅ Presence beacon started
✅ Serverless Mobile Mesh Radar initialized successfully
```

### Test 3.2: Check Network Status
1. Open the app
2. Navigate to **Settings** or **Network Status** (if available)
3. Or check browser console via Chrome DevTools

**In Chrome DevTools (chrome://inspect):**
```javascript
// Check network state
networkStateManager.getStatus()

// Should show all services as healthy
```

---

## 👥 Step 4: Test Peer Discovery

### Test 4.1: Single Device Self-Discovery
1. Open XitChat on device H6
2. Open XitChat in a browser on your computer (same WiFi)
3. Wait 10-15 seconds
4. Check if peers appear in radar

**Expected:**
- Device H6 should see your computer as a peer
- Computer should see device H6 as a peer
- Connection type should show (Nostr, WebRTC, WiFi, etc.)

### Test 4.2: Multi-Device Discovery (If you have another phone)
1. Install XitChat on a second Android device
2. Launch on both devices
3. Wait for discovery (10-20 seconds)
4. Both devices should see each other in the radar

**Check Logs:**
```
📡 Received peer announcement from: wifi-xxxxx
🗼 Radar now shows X visible peers (TTL-filtered)
```

---

## 💬 Step 5: Test Real-Time Chat

### Test 5.1: Browser to Android Chat
1. **On Device H6:** Open a chat or wait for messages
2. **On Computer Browser:** Open XitChat, find device H6 in peers
3. **Send message from browser:** Type "Hello from browser"
4. **Check Device H6:** Message should appear within 1-2 seconds

**Expected Transport Priority:**
1. WebRTC (if connection established) - **Fastest**
2. Nostr (fallback) - **Reliable**
3. WiFi P2P (local network)

### Test 5.2: Android to Browser Chat
1. **On Device H6:** Find browser peer in list
2. **Send message:** Type "Hello from Android H6"
3. **Check Browser:** Message should appear quickly

**Check Logs:**
```
📤 Sending via serverless WiFi P2P to wifi-xxxxx: Hello from Android H6
📤 Sent via WebRTC P2P to wifi-xxxxx: Hello from Android H6
```

### Test 5.3: Message Delivery Confirmation
- [ ] Messages sent from Android appear on browser
- [ ] Messages sent from browser appear on Android
- [ ] Timestamps are correct
- [ ] No duplicate messages
- [ ] Messages persist after app restart (if implemented)

---

## 🏠 Step 6: Test Room Functionality

### Test 6.1: Create and Join Room
1. **On Device H6:** Navigate to **Rooms** tab
2. **Create a new room:** "Test Room 1"
3. **On Browser:** Join the same room
4. Both should see each other in the room

### Test 6.2: Room Chat
1. **Send message in room from Android:** "Testing room chat"
2. **Check browser:** Message should appear
3. **Reply from browser:** "Room chat working!"
4. **Check Android:** Reply should appear

**Expected:**
- Room messages broadcast to all participants
- Presence updates when users join/leave
- Room list updates in real-time

### Test 6.3: Multi-User Room (If available)
1. Join the same room from 3+ devices/browsers
2. Send messages from each
3. All should receive all messages
4. Check for message ordering

---

## 🔄 Step 7: Test Connection Switching

### Test 7.1: Network Change Handling
1. **Start with WiFi + Bluetooth on**
2. **Send messages** - Should work
3. **Turn off WiFi** - App should switch to Bluetooth/Nostr
4. **Send message** - Should still work (via Nostr)
5. **Turn WiFi back on** - Should reconnect to WebRTC

**Check Logs:**
```
🌐 Radar handling network change: offline
📴 Radar switching to offline mode
🌐 Radar resuming online operations
```

### Test 7.2: Bluetooth Toggle
1. **Turn off Bluetooth**
2. Check if app switches to WiFi/Nostr
3. **Turn Bluetooth back on**
4. Check if Bluetooth layer reinitializes

---

## 📊 Step 8: Performance Testing

### Test 8.1: Message Latency
1. Send 10 messages rapidly from browser to Android
2. Measure time between send and receive
3. **Expected:** < 500ms for WebRTC, < 2s for Nostr

### Test 8.2: Peer Discovery Time
1. Close app on Android
2. Reopen app
3. Measure time until peers appear
4. **Expected:** 5-15 seconds

### Test 8.3: Battery Usage
1. Use app for 30 minutes
2. Check battery drain
3. **Expected:** < 5% battery per 30 minutes

---

## 🐛 Step 9: Error Scenarios

### Test 9.1: No Internet Connection
1. Turn off WiFi and mobile data
2. App should show offline mode
3. Local Bluetooth/WiFi Direct should still work

### Test 9.2: Permission Denied
1. Revoke Bluetooth permission
2. App should show permission request
3. Grant permission
4. Bluetooth layer should reinitialize

### Test 9.3: App Background/Foreground
1. Send message to Android
2. Put app in background (home button)
3. Check if notification appears
4. Open app - message should be there

---

## ✅ Success Criteria

### Minimum Requirements (Must Pass)
- [ ] App launches without crashes
- [ ] At least one network layer initializes (Nostr minimum)
- [ ] Can discover at least one peer (browser or another device)
- [ ] Can send and receive messages
- [ ] Messages appear in real-time (< 5 seconds)

### Optimal Performance (Should Pass)
- [ ] All 5 network layers initialize successfully
- [ ] Peer discovery < 15 seconds
- [ ] Message latency < 2 seconds
- [ ] No crashes during 30-minute session
- [ ] Automatic reconnection after network changes

### Advanced Features (Nice to Have)
- [ ] WebRTC direct connections established
- [ ] Room functionality works perfectly
- [ ] Offline mode works
- [ ] Background notifications work
- [ ] Multi-device sync works

---

## 📝 Test Results Template

```markdown
## Test Session: [Date/Time]
**Device:** H6 (1MA75199ZA1G80B1P1X0407)
**Tester:** [Your Name]

### Network Initialization
- WiFi P2P: ✅ / ❌
- Bluetooth: ✅ / ❌
- Nostr: ✅ / ❌
- WebRTC: ✅ / ❌
- Broadcast: ✅ / ❌

### Peer Discovery
- Browser to Android: ✅ / ❌ (Time: ___ seconds)
- Android to Browser: ✅ / ❌ (Time: ___ seconds)

### Messaging
- Browser → Android: ✅ / ❌ (Latency: ___ ms)
- Android → Browser: ✅ / ❌ (Latency: ___ ms)
- Room Chat: ✅ / ❌

### Issues Found
1. [Issue description]
2. [Issue description]

### Notes
[Any additional observations]
```

---

## 🔧 Troubleshooting

### Issue: No peers discovered
**Solutions:**
1. Check if Nostr relays are connected (logs should show relay connections)
2. Verify both devices are on same WiFi network
3. Check firewall settings
4. Ensure presence beacon is running: `presenceBeacon.start()`

### Issue: Messages not received
**Solutions:**
1. Check connection type in logs
2. Verify peer is still online (check lastSeen timestamp)
3. Try sending via different transport
4. Check browser console for errors

### Issue: App crashes
**Solutions:**
1. Check Logcat for crash logs
2. Clear app data: `adb shell pm clear com.xitchat.app`
3. Reinstall app
4. Check for permission issues

### Issue: Slow performance
**Solutions:**
1. Close other apps
2. Check network speed
3. Reduce number of active connections
4. Check for memory leaks in Logcat

---

## 🎯 Quick Test Commands

```bash
# Check if app is running
adb -s 1MA75199ZA1G80B1P1X0407 shell dumpsys activity | findstr "xitchat"

# Clear app data (fresh start)
adb -s 1MA75199ZA1G80B1P1X0407 shell pm clear com.xitchat.app

# Force stop app
adb -s 1MA75199ZA1G80B1P1X0407 shell am force-stop com.xitchat.app

# Restart app
adb -s 1MA75199ZA1G80B1P1X0407 shell am start -n com.xitchat.app/.MainActivity

# Take screenshot
adb -s 1MA75199ZA1G80B1P1X0407 shell screencap -p /sdcard/screenshot.png
adb -s 1MA75199ZA1G80B1P1X0407 pull /sdcard/screenshot.png

# Record screen (for demos)
adb -s 1MA75199ZA1G80B1P1X0407 shell screenrecord /sdcard/test.mp4
# Press Ctrl+C to stop, then:
adb -s 1MA75199ZA1G80B1P1X0407 pull /sdcard/test.mp4
```

---

## 📞 Remote Debugging

### Chrome DevTools for Android
1. Open Chrome on your computer
2. Go to `chrome://inspect`
3. Find your device H6
4. Click **Inspect** next to XitChat
5. You can now use full Chrome DevTools!

**Useful Console Commands:**
```javascript
// Check all peers
realtimeRadar.getPeers()

// Check network status
networkStateManager.getStatus()

// Check Nostr connection
nostrService.isConnected()

// Check WiFi P2P status
wifiP2P.getConnectionInfo()

// Force presence update
presenceBeacon.announcePresence()
```

---

## 🎉 Next Steps After Testing

1. **Document all issues** found during testing
2. **Take screenshots/videos** of working features
3. **Note performance metrics** (latency, discovery time, etc.)
4. **Test with multiple devices** if available
5. **Prepare bug reports** for any issues
6. **Celebrate successful features!** 🎊

---

**Happy Testing! 🚀**

If you encounter any issues, check the logs first, then refer to the troubleshooting section.
