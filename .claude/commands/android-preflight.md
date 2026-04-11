# /android-preflight — Android Pre-Deploy Checklist

Run this before every Play Store release to catch the class of issues that
blocked users from accessing the app.

## What to check

### 1. Placeholder URLs
Search for placeholder values that would break app functionality:
- `services/gemma-local.ts` — `GEMMA_MODEL_URL` must NOT contain `your-cdn.com`
- If it is still a placeholder, the Gemma AI feature will be silently skipped (safe),
  but XitBot AI won't work until a real URL is configured.

```bash
grep -rn "your-cdn.com" services/ App.tsx
```

### 2. Plugin registration
Every Java plugin must be registered in `MainActivity.java`. Check that all three
are present:

```bash
grep "registerPlugin" android/app/src/main/java/com/xitchat/app/MainActivity.java
```

Expected output must include:
- `BluetoothMeshPlugin.class`
- `WiFiDirectPlugin.class`
- `GemmaPlugin.class`

### 3. Plugin name consistency
The `@CapacitorPlugin(name = "...")` annotation in each Java file must exactly
match the string passed to `registerPlugin<any>('...')` in TypeScript.

| Java file            | Expected name  | TS call in                  |
|----------------------|----------------|-----------------------------|
| BluetoothMeshPlugin  | `BluetoothMesh`| nativeAndroidPlugins.ts     |
| WiFiDirectPlugin     | `WiFiDirect`   | nativeAndroidPlugins.ts     |
| GemmaPlugin          | `GemmaLocal`   | services/gemma-local.ts     |

```bash
grep "@CapacitorPlugin" android/app/src/main/java/com/xitchat/app/*.java
```

### 4. versionCode bump
Every Play Store upload requires a higher `versionCode` than the last published
version. Check `android/app/build.gradle`:

```bash
grep -E "versionCode|versionName" android/app/build.gradle
```

Increment `versionCode` by 1 before every release. `versionName` is for display
only but should also be updated.

### 5. AndroidManifest permissions
These permissions are required for core features. Missing any will cause runtime
failures:

```bash
grep -E "BLUETOOTH_SCAN|BLUETOOTH_ADVERTISE|BLUETOOTH_CONNECT|NEARBY_WIFI_DEVICES|ACCESS_FINE_LOCATION" \
  android/app/src/main/AndroidManifest.xml
```

### 6. Web build + Capacitor sync
A stale `dist/` or un-synced Capacitor project means the APK runs old code.
Always run both before building:

```bash
npm run build:mobile
npx cap sync android
```

### 7. Debug APK smoke test
Build a debug APK and install it on a real device (or emulator) before uploading
to Play Store:

```bash
cd android && ./gradlew assembleDebug
# Then: adb install app/build/outputs/apk/debug/app-debug.apk
```

Verify:
- [ ] App opens immediately to onboarding (not stuck on Gemma download screen)
- [ ] Bluetooth / WiFi mesh permissions prompt appears on first use
- [ ] Chat works (at minimum via Nostr relay)
- [ ] Profile save / avatar works
- [ ] No crash on rotate / background / resume

### 8. Release build (Play Store)
Only sign and upload once all checks above pass:

```bash
# Requires keystore.properties to be set up with your signing key
cd android && ./gradlew bundleRelease
```

Upload `android/app/build/outputs/bundle/release/app-release.aab` to the
Play Store internal track first, promote to production after testing.

## Common failure patterns

| Symptom | Likely cause | Fix |
|---|---|---|
| Users stuck on download screen at install | `GEMMA_MODEL_URL` is placeholder | Set real URL or skip Gemma until ready |
| `"Plugin.then() is not implemented on android"` | Plugin proxy returned from `async` function — Promise resolution calls `.then()` on it | Make plugin getters synchronous; `registerPlugin()` is synchronous |
| Plugin calls silently do nothing on Android | Plugin name mismatch (JS vs Java) | Verify `@CapacitorPlugin(name=...)` matches `registerPlugin('...')` |
| Play Store rejects upload | `versionCode` not incremented | Bump `versionCode` in `build.gradle` |
| Bluetooth/WiFi features crash immediately | Missing `BLUETOOTH_SCAN` / `NEARBY_WIFI_DEVICES` permissions | Add to `AndroidManifest.xml` |
| App shows blank screen | JS build not synced to Android | Run `npm run build:mobile && npx cap sync android` |
| Gradle build fails | Java / Capacitor version mismatch | Ensure `JAVA_VERSION=17` and `@capacitor/android ^6.0.0` |
