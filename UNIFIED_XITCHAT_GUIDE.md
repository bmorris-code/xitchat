# XitChat Unified Documentation & Technical Guide

This document serves as the single source of truth for the XitChat project, consolidating all technical documentation, setup guides, and fix history.

---

## 1. Project Overview
XitChat is a modern, serverless mesh networking chat application inspired by the nostalgic Mxit and BitChat platforms. It enables decentralized communication through multiple network layers, prioritizing direct peer-to-peer (P2P) connections.

### Key Features
- **5-Layer Hybrid Mesh**: Bluetooth, WebRTC, WiFi P2P, Nostr, and UDP Broadcast.
- **Serverless Architecture**: Direct device-to-device communication without central servers.
- **Privacy First**: Secure image sharing and encrypted messaging (NIP-04).
- **Gamified Economy**: XC Tokens and automated "Joe Banker" bots.
- **Real-time Radar**: Discovery of nearby nodes using geohashing.

---

## 2. Technical Architecture

### Core Service Modules
- **`hybridMesh.ts`**: The orchestrator that manages all 5 network layers and selects the best path for message delivery.
- **`nostrService.ts`**: Global decentralized messaging via Nostr relays (NIP-01/04).
- **`workingBluetoothMesh.ts`**: Native Android Bluetooth Low Energy (BLE) mesh implementation.
- **`wifiP2P.ts`**: Android WiFi Direct implementation for high-bandwidth P2P transfers.
- **`hybridAI.ts`**: Intelligent bot responses using Groq (Primary) and Gemini (Fallback).
- **`presenceBeacon.ts`**: Manages node discovery and status broadcasting across the mesh.

### Tech Stack
- **Frontend**: React 19, Vite, Tailwind CSS.
- **Mobile**: Capacitor 6 (Native Android/iOS).
- **Networking**: nostr-tools, @noble/secp256k1, ably-js (WebRTC).
- **AI**: Groq SDK, Google Generative AI.

---

## 3. Deployment & Setup

### Android Setup (Android Studio)
1. **Sync Assets**: `npm run sync:android`
2. **Open Project**: Open the `android/` folder in Android Studio.
3. **Hardware Config**: Ensure Bluetooth and Location services are enabled.
4. **Permissions**: The app requests `BLUETOOTH_SCAN`, `BLUETOOTH_ADVERTISE`, `ACCESS_FINE_LOCATION`, and `NEARBY_DEVICES`.

### Build & Run Commands
- **Sync & Build**: `npm run sync:android`
- **Rebuild APK**: `cd android; .\gradlew.bat assembleDebug`
- **Install & Launch**: `adb install -r android\app\build\outputs\apk\debug\app-debug.apk; adb shell am start -n com.xitchat.app/.MainActivity`

---

## 4. Testing & Validation

### Quick Test Reference
1. **Launch**: Open the app on Android (H6).
2. **Scan**: Click the "+ SCAN" button in the active nodes list.
3. **Radar Check**: Verify peers appear in the Radar tab within 20 seconds.
4. **Message Test**: Send a message to XitBot or use the `test-companion.html` to send a message via Nostr.

### Debugging Tools
- **Chrome Inspect**: Visit `chrome://inspect` on your desktop to debug the WebView.
- **Logcat**: Use `adb logcat -s Capacitor/Console` to view JS logs.
- **Network Health**: Type `networkStateManager.getStatus()` in the browser console.

---

## 5. Maintenance & Fix History

### [2026-02-13] Blank Screen & AI Fixes
- **Issue**: App showed a blank/black screen on Android H6 after build.
- **Cause**: Incompatible `es2015` build target in Vite for modern crypto libraries (BigInt support).
- **Fix**: Updated `vite.config.ts` to `target: 'esnext'`.
- **AI Fix**: Updated decommissioned Groq models (`llama-3.1-70b-versatile` -> `llama-3.3-70b-versatile`).

### [Previous Fixes]
- **Native Send Error**: Silenced Bluetooth native plugin errors when running in browser or when hardware is unavailable.
- **Nostr Key Fix**: Improved private key validation and robust hex-to-bytes conversion.
- **PWA Layout**: Adjusted iOS safe-area-insets for PWA home screen mode.

---

## 6. Project Directory Map
- `/components`: UI React components.
- `/services`: Core logic and networking services.
- `/android`: Capacitor Android project files.
- `/utils`: Helper functions and formatting.
- `index.html`: Main entry point and global polyfills.

---
*Last Updated: 2026-02-13*
