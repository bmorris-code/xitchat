# XitChat Mesh Testing Checklist

## Pre-Deployment Tests

### ✅ Web App (https://xitxhat-9.vercel.app)
- [ ] App loads correctly on desktop Chrome
- [ ] App loads on mobile browsers
- [ ] HTTPS certificate valid
- [ ] No console errors

### ✅ Android Testing (Chrome Mobile)
- [ ] Bluetooth permission requested
- [ ] Device discovery works
- [ ] Pairing successful
- [ ] Mesh messages send/receive
- [ ] Node discovery shows nearby devices
- [ ] Chat functionality works via Bluetooth

### ✅ iOS Testing (Safari)
- [ ] WebRTC peer connection establishes
- [ ] Signaling server connects
- [ ] Data channel opens
- [ ] Messages send/receive via WebRTC
- [ ] Chat functionality works via WebRTC

### ✅ Cross-Platform Tests
- [ ] Android ↔ iOS communication works
- [ ] Desktop ↔ Mobile communication works
- [ ] Multi-user mesh network forms
- [ ] Message relay through intermediate nodes
- [ ] Network healing on disconnect

## Production Deployment

### 🚀 Signaling Server
- [ ] Deploy to Railway/Render with WebSocket support
- [ ] Update WebRTC service URL
- [ ] Test WebSocket connection
- [ ] Verify SSL certificate

### 🚀 App Configuration
- [ ] Update environment variables
- [ ] Test production build
- [ ] Verify all APIs work in production

## User Experience Tests

### 📱 Onboarding
- [ ] First-time user experience smooth
- [ ] Permissions requested appropriately
- [ ] Connection method auto-detected
- [ ] Clear instructions for each platform

### 💬 Core Features
- [ ] Profile creation works
- [ ] Friend discovery works
- [ ] Room joining/creation works
- [ ] Trading services accessible
- [ ] XC economy features work

### 🔧 Edge Cases
- [ ] Poor network connectivity handling
- [ ] Bluetooth/WebRTC fallback works
- [ ] App works offline (local mesh)
- [ ] Data persistence across sessions
- [ ] Error handling user-friendly

## Performance Tests

### ⚡ Load Testing
- [ ] Multiple concurrent connections
- [ ] Message throughput acceptable
- [ ] Memory usage reasonable
- [ ] Battery impact minimal

### 📊 Metrics to Monitor
- [ ] Connection success rate
- [ ] Message delivery time
- [ ] Network stability
- [ ] User engagement

## Security Tests

### 🔒 Privacy & Security
- [ ] Message encryption works
- [ ] No data leaks in logs
- [ ] Secure WebSocket connections
- [ ] Proper permission handling
