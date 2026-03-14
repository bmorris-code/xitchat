# 🧪 Quick Test Guide - Message Delivery Fix

## Before You Start
1. Open browser console (F12) to see detailed logs
2. Make sure you have at least 2 devices/browsers ready
3. Note: First message might take 2-3 seconds as Nostr relays connect

## Test Scenario 1: Web ↔ Web Chat (Nostr)

### Setup
1. **Browser A:** Open `http://localhost:5173` (or your deployed URL)
2. **Browser B:** Open same URL in different browser/incognito

### Steps
1. **Browser A:** Complete onboarding, note your handle (e.g., `@alice`)
2. **Browser B:** Complete onboarding, note your handle (e.g., `@bob`)
3. **Browser A:** Click "New Chat" → Enter `@bob` → Start chat
4. **Browser A:** Send message: "Hello from Alice"
5. **Watch console logs** in Browser A

### Expected Console Output (Browser A)
```
📤 Sending message to abc123... via nostr...
📤 Sending Nostr DM to abc123... via 3 relays
✅ Nostr DM sent successfully
✅ Message sent successfully via nostr to abc123...
📤 Message sent confirmation: msg_xyz via nostr
```

### Expected UI (Browser A)
- Message appears with green badge: **"DELIVERED:NOSTR"**
- Badge appears within 1-2 seconds

### Expected Result (Browser B)
- Message appears in chat from `@alice`
- Shows: "Hello from Alice"

---

## Test Scenario 2: Android APK ↔ Android APK (Bluetooth)

### Setup
1. Install APK on **Phone A** and **Phone B**
2. Grant Bluetooth + Location permissions on both
3. Keep phones within 10 meters

### Steps
1. **Phone A:** Complete onboarding, note handle
2. **Phone B:** Complete onboarding, note handle
3. **Wait 10 seconds** for Bluetooth discovery
4. **Phone A:** Should see Phone B in "Nearby" list
5. **Phone A:** Tap Phone B → Start chat
6. **Phone A:** Send message: "Hello via Bluetooth"

### Expected Logs (Phone A - use `adb logcat`)
```
📤 Sending message to device_xyz via bluetooth...
✅ Message sent successfully via bluetooth to device_xyz
```

### Expected UI (Phone A)
- Message shows: **"DELIVERED:BLUETOOTH"**
- Badge appears immediately (< 1 second)

### Expected Result (Phone B)
- Notification appears
- Message visible in chat

---

## Test Scenario 3: Web ↔ Android APK (Nostr)

### Setup
1. **Web Browser:** Open app
2. **Android Phone:** Open APK

### Steps
1. **Web:** Complete onboarding, get handle `@webuser`
2. **Phone:** Complete onboarding, get handle `@phoneuser`
3. **Web:** New Chat → Enter `@phoneuser`
4. **Web:** Send: "Hello from web"

### Expected Console (Web)
```
📤 Sending message to npub1... via nostr...
📤 Sending Nostr DM to npub1... via 3 relays
✅ Nostr DM sent successfully
✅ Message sent successfully via nostr
```

### Expected UI (Web)
- **"DELIVERED:NOSTR"** within 2 seconds

### Expected Result (Phone)
- Message appears from `@webuser`

---

## Test Scenario 4: Failed Delivery (No Internet)

### Setup
1. Open app in browser
2. **Turn off WiFi/Data** on your device

### Steps
1. Try to send a message
2. Watch console logs

### Expected Console
```
📤 Sending message to abc123... via nostr...
⚠️ Cannot send Nostr DM: No connected relays
⚠️ Failed to send message to abc123... via nostr
⚠️ Message send returned false - may not have been delivered
```

### Expected UI
- Message shows red badge: **"FAILED:SEND_FAILED"**
- Badge appears within 1 second

---

## Debugging Tips

### If message stuck on "SENDING":
1. Check console for errors
2. Verify Nostr relays are connected:
   ```
   ✅ Nostr relay connected: wss://relay.damus.io
   ```
3. Check if peer is in peers map:
   ```
   Mesh peers updated: [...]
   ```

### If "FAILED" appears:
1. Check internet connection
2. Verify recipient handle is correct
3. Check if Nostr relays are reachable
4. Try refreshing the page

### If message shows "DELIVERED" but recipient doesn't receive:
1. Check if recipient's app is open
2. Verify recipient completed onboarding
3. Check if recipient's Nostr relays are connected
4. Try sending from recipient to sender (reverse direction)

---

## Success Criteria

✅ **Web ↔ Web:** Messages show "DELIVERED:NOSTR" within 2 seconds  
✅ **APK ↔ APK:** Messages show "DELIVERED:BLUETOOTH" immediately  
✅ **Web ↔ APK:** Messages show "DELIVERED:NOSTR" within 2 seconds  
✅ **Failed sends:** Messages show "FAILED:SEND_FAILED" within 1 second  
✅ **Console logs:** Detailed logs show send progress  

---

## Next Steps After Testing

If all tests pass:
1. ✅ Message delivery is working correctly
2. ✅ Ready for friend chat testing
3. ✅ Can proceed with public launch preparation

If tests fail:
1. Share console logs with developer
2. Note which scenario failed
3. Check network connectivity
4. Verify app permissions

