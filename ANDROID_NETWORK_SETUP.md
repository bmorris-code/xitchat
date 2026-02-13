# Android Network Setup Guide

## Quick Start for Real-time Connections

### 1. Start Signaling Server
```bash
cd "c:\Users\branw\Downloads\xitchat (9)\Fixes\server"
node signaling-server.js
```

### 2. Android Device Settings

#### Enable Local Network Access
1. Go to **Settings** > **Wi-Fi**
2. Connect to the same network as your computer
3. Note your computer's IP address (run `ipconfig` in Windows)

#### Required Permissions
The app will automatically request:
- ✅ Location (for Bluetooth/WiFi Direct)
- ✅ Camera (for QR scanning)
- ✅ Nearby Devices (Android 12+)

#### Manual Permission Check
1. Settings > Apps > XitChat > Permissions
2. Ensure all permissions are **Granted**
3. If any are "Denied", tap and select "Allow"

### 3. Network Configuration

#### Find Your Computer's IP
```cmd
ipconfig
```
Look for "IPv4 Address" (usually 192.168.x.x)

#### Update App Configuration
The app will automatically detect the signaling server, but if needed:
- Open browser dev tools on Android
- Check console for connection attempts
- Verify it finds your server IP

### 4. Testing Connection

#### Step 1: Verify Server
Open http://localhost:8443/status in your computer's browser
Should show: `{"connectedPeers":0,"activeRooms":0}`

#### Step 2: Test Android
1. Open XitChat on first Android device
2. Go to Radar view
3. Check console for "✅ Connected to signaling server"

#### Step 3: Connect Second Device
1. Open XitChat on second Android device  
2. Both devices should appear in each other's radar
3. Try sending a test message

### 5. Troubleshooting

#### No Devices Showing
- Check both devices on same Wi-Fi
- Verify signaling server running
- Check Android permissions
- Restart app on both devices

#### Connection Errors
- Check firewall blocking port 8443
- Try different Wi-Fi network
- Restart signaling server
- Clear app cache

#### Messages Not Real-time
- Check WebRTC connection status
- Verify both devices have good signal
- Try switching to Bluetooth only mode

### 6. Advanced Options

#### Manual IP Configuration
If auto-detection fails, the app tests these IPs:
- ws://192.168.1.100:8443
- ws://192.168.0.100:8443
- ws://localhost:8443

#### Firewall Settings
Add exception for:
- Port 8443 (TCP)
- Node.js application

### 7. Success Indicators
✅ Signaling server running on port 8443  
✅ Both Android devices show in radar  
✅ Messages appear instantly  
✅ Real-time location updates working  

## Need Help?
Check the browser console on Android devices for detailed connection logs.
