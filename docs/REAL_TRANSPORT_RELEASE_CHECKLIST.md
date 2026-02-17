# XitChat Real Transport Release Checklist

Use this before every public deploy.

## 1. Build And Packaging
- [ ] `npm run build` passes with no errors.
- [ ] Android debug build succeeds: `cd android && gradlew.bat assembleDebug`.
- [ ] Android release build succeeds: `cd android && gradlew.bat assembleRelease`.
- [ ] CI artifact jobs pass for APK/AAB upload and release.

## 2. Android Real Mesh Gate
- [ ] App starts without `Real Mesh Required` blocker on Android.
- [ ] Nearby Devices permission granted.
- [ ] Location permission granted.
- [ ] Bluetooth enabled on device.
- [ ] WiFi enabled on device.

## 3. Two-Device Local Offline Test (No Internet)
- [ ] Disable mobile data and internet on both devices.
- [ ] Device A discovers Device B in mesh status.
- [ ] Device B discovers Device A in mesh status.
- [ ] Direct chat A -> B delivers within 5s.
- [ ] Direct chat B -> A delivers within 5s.
- [ ] Create room on A; B can join and exchange messages.

## 4. Background Resilience
- [ ] Put app on Device B in background for 2 minutes.
- [ ] Bring Device B to foreground.
- [ ] Mesh reconnects automatically.
- [ ] New message from A is received by B after resume.

## 5. Online Global Sync (Nostr)
- [ ] Re-enable internet.
- [ ] Nostr shows connected relays.
- [ ] Direct Nostr message succeeds.
- [ ] Room/global message syncs across devices.

## 6. Desktop Web + Android Interop
- [ ] Desktop loads app with no fatal errors.
- [ ] Desktop can send/receive via Nostr with Android.
- [ ] Room create/join works on desktop + Android.
- [ ] Radar/peer updates appear on both.

## 7. Failure Criteria (Do Not Release If Any True)
- [ ] Any simulation/fake peer behavior observed.
- [ ] Android mesh blocker appears after permissions are granted and radios enabled.
- [ ] Message send shows success but never reaches peer in repeated tests.
- [ ] App crashes during mesh init, room join, or background resume.

## 8. Sign-Off
- [ ] QA sign-off
- [ ] Android test sign-off
- [ ] Desktop web test sign-off
- [ ] Release owner sign-off
