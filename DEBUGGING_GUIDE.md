# 🔍 XitChat Android H6 - Debugging Guide

## ❓ Issue: "Nothing showing on mobile"

You mentioned testing but nothing is showing on the mobile. Let's debug this step by step.

---

## 🔍 Step 1: Verify App is Running

### Check if app is installed and running:
```bash
# Check if installed
adb -s 1MA75199ZA1G80B1P1X0407 shell pm list packages | findstr xitchat

# Check if running
adb -s 1MA75199ZA1G80B1P1X0407 shell dumpsys activity | findstr "xitchat"
```

**Status:** ✅ App is installed and running (confirmed)

---

## 🔍 Step 2: Use Chrome DevTools (BEST METHOD)

This is the most effective way to debug your Android app!

### How to Access:

1. **Open Chrome on your computer**
2. **Navigate to:** `chrome://inspect`
3. **Find your device:** Look for "1MA75199ZA1G80B1P1X0407"
4. **Find XitChat:** Under your device, you should see "com.xitchat.app"
5. **Click "Inspect"** - This opens full Chrome DevTools!

### What You Can Do:

#### **View Console Logs:**
- See all JavaScript console.log messages
- Check for errors (red messages)
- See network initialization messages

#### **Check Network Status:**
In the Console tab, type:
```javascript
// Check if networks are initialized
hybridMesh.getActiveServices()

// Check peers
realtimeRadar.getPeers()

// Check Nostr connection
nostrService.isConnected()

// Check presence beacon
presenceBeacon.getMyPresence()
```

#### **Debug Issues:**
- **Elements tab:** See the actual HTML/CSS
- **Network tab:** See API calls
- **Console tab:** See all logs and errors
- **Sources tab:** Debug JavaScript code

---

## 🔍 Step 3: Check What "Nothing" Means

### Scenario A: App Shows Blank Screen
**Possible causes:**
- JavaScript error preventing app from loading
- Build issue
- Missing assets

**Solution:**
1. Open Chrome DevTools (chrome://inspect)
2. Check Console for red errors
3. Look for "Failed to load" messages

### Scenario B: App Loads But No Peers/Messages
**Possible causes:**
- Networks not initialized
- No other devices connected
- Permissions not granted

**Solution:**
1. Check if you granted all permissions (Bluetooth, Location, etc.)
2. Check if Nostr is connected
3. Make sure you have another device/browser running XitChat

### Scenario C: Can't Send/Receive Messages
**Possible causes:**
- No peers discovered
- Network layers not working
- Message routing issue

**Solution:**
1. Check active networks in DevTools
2. Verify peer discovery
3. Check logs for message send attempts

---

## 🧪 Step 4: Systematic Testing

### Test 1: Verify App Loads
**On your Android H6:**
1. Open XitChat app
2. Do you see the main interface?
3. Can you navigate between tabs (Chats, Rooms, Buzz, Map, Games)?

**Expected:** ✅ You should see the full app interface

**If blank screen:**
- Use Chrome DevTools to check for errors
- Check if permissions were granted

### Test 2: Check Network Initialization
**Using Chrome DevTools:**
```javascript
// Should return object with true values
hybridMesh.getActiveServices()
// Expected: { nostr: true, broadcast: true, wifi: true, bluetooth: true }
```

**Expected:** ✅ At least Nostr and Broadcast should be true

**If all false:**
- App didn't initialize properly
- Check Console for initialization errors

### Test 3: Check Peer Discovery
**Using Chrome DevTools:**
```javascript
// Should return array of peers
realtimeRadar.getPeers()
// Expected: Array with peer objects (may be empty if no other devices)
```

**Expected:** 
- If testing alone: Empty array `[]` is normal
- If testing with browser: Should show browser peer

**To test peer discovery:**
1. Open `test-companion.html` in browser on your computer
2. Click "Initialize Test Environment"
3. Wait 10-20 seconds
4. Check `realtimeRadar.getPeers()` again
5. Should now show browser as a peer

### Test 4: Send Test Message
**Using Chrome DevTools Console:**
```javascript
// Send a test message
hybridMesh.sendMessage("Test from Android console")

// Check if it was sent
// Look for "Message sent via [Network]" in console
```

**Expected:** ✅ Should see success message in console

---

## 🔧 Common Issues & Solutions

### Issue 1: Blank/White Screen
**Symptoms:** App opens but shows nothing

**Debug:**
```javascript
// In Chrome DevTools Console
document.body.innerHTML.length
// If 0 or very small, app didn't load
```

**Solutions:**
1. Clear app data: `adb -s 1MA75199ZA1G80B1P1X0407 shell pm clear com.xitchat.app`
2. Reinstall app
3. Check for JavaScript errors in Console

### Issue 2: No Peers Showing
**Symptoms:** App works but radar is empty

**Debug:**
```javascript
// Check if presence beacon is running
presenceBeacon.getMyPresence()
// Should return your presence info

// Check if Nostr is connected
nostrService.isConnected()
// Should return true
```

**Solutions:**
1. Make sure you have another device running XitChat
2. Both devices should be on same WiFi (for local discovery)
3. Wait 20-30 seconds for Nostr discovery
4. Check if permissions are granted

### Issue 3: Can't Send Messages
**Symptoms:** Can see peers but messages don't send

**Debug:**
```javascript
// Check active networks
hybridMesh.getActiveServices()
// At least one should be true

// Try sending directly via Nostr
nostrService.broadcastMessage("Test")
```

**Solutions:**
1. Check if Nostr is connected
2. Verify peer is online (check lastSeen)
3. Try sending via different network

### Issue 4: Permissions Not Granted
**Symptoms:** App asks for permissions repeatedly

**Solution:**
1. Go to Android Settings → Apps → XitChat → Permissions
2. Grant ALL permissions:
   - ✅ Location (for mesh networking)
   - ✅ Bluetooth (for BLE mesh)
   - ✅ Camera (for media)
   - ✅ Notifications (for alerts)
3. Restart app

---

## 📱 Quick Diagnostic Commands

### Check App Status:
```bash
# Is app installed?
adb -s 1MA75199ZA1G80B1P1X0407 shell pm list packages | findstr xitchat

# Is app running?
adb -s 1MA75199ZA1G80B1P1X0407 shell pidof com.xitchat.app

# Get app version
adb -s 1MA75199ZA1G80B1P1X0407 shell dumpsys package com.xitchat.app | findstr versionName
```

### Restart App:
```bash
# Force stop
adb -s 1MA75199ZA1G80B1P1X0407 shell am force-stop com.xitchat.app

# Start again
adb -s 1MA75199ZA1G80B1P1X0407 shell am start -n com.xitchat.app/.MainActivity
```

### Clear App Data (Fresh Start):
```bash
# Clear all data
adb -s 1MA75199ZA1G80B1P1X0407 shell pm clear com.xitchat.app

# Launch app
adb -s 1MA75199ZA1G80B1P1X0407 shell am start -n com.xitchat.app/.MainActivity
```

### Take Screenshot (See what's on screen):
```bash
# Capture screenshot
adb -s 1MA75199ZA1G80B1P1X0407 shell screencap -p /sdcard/xitchat_screen.png

# Download to computer
adb -s 1MA75199ZA1G80B1P1X0407 pull /sdcard/xitchat_screen.png

# Now open xitchat_screen.png to see what's on the screen
```

---

## 🎯 Recommended Debugging Steps

### Step 1: Take Screenshot
```bash
adb -s 1MA75199ZA1G80B1P1X0407 shell screencap -p /sdcard/screen.png
adb -s 1MA75199ZA1G80B1P1X0407 pull /sdcard/screen.png
```
Open `screen.png` to see what's actually on the screen

### Step 2: Use Chrome DevTools
1. Open `chrome://inspect` in Chrome
2. Find your device and click "Inspect"
3. Check Console for errors
4. Run diagnostic commands (see above)

### Step 3: Check Logs
```bash
# Real-time logs
adb -s 1MA75199ZA1G80B1P1X0407 logcat | findstr "Capacitor"
```

### Step 4: Test with Browser
1. Open `test-companion.html` in browser
2. Initialize test environment
3. Check if Android discovers browser peer
4. Try sending message from browser to Android

---

## 🔍 What to Tell Me

To help you better, please let me know:

1. **What do you see on the screen?**
   - Blank/white screen?
   - App interface but empty?
   - Error message?
   - Something else?

2. **Did you open Chrome DevTools?**
   - Go to `chrome://inspect`
   - Find your device
   - Click "Inspect"
   - What do you see in Console?

3. **Did you try test-companion.html?**
   - Did you open it in browser?
   - Did you click "Initialize Test Environment"?
   - Did it discover any peers?

4. **What were you testing?**
   - Peer discovery?
   - Sending messages?
   - Room chat?
   - Something else?

---

## 🚀 Quick Fix Attempts

### Try 1: Clear and Restart
```bash
adb -s 1MA75199ZA1G80B1P1X0407 shell pm clear com.xitchat.app
adb -s 1MA75199ZA1G80B1P1X0407 shell am start -n com.xitchat.app/.MainActivity
```

### Try 2: Take Screenshot
```bash
adb -s 1MA75199ZA1G80B1P1X0407 shell screencap -p /sdcard/screen.png
adb -s 1MA75199ZA1G80B1P1X0407 pull /sdcard/screen.png
```

### Try 3: Use Chrome DevTools
1. Open Chrome: `chrome://inspect`
2. Click "Inspect" next to XitChat
3. Check Console tab for errors
4. Run: `hybridMesh.getActiveServices()`

---

**Let me know what you see and I can help you debug further!** 🔍
