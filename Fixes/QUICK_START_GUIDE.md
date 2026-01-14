# XitChat Quick Start Guide

## 🚀 Getting Started with Nostr Integration

### Prerequisites
- Flutter SDK installed
- Android Studio or Xcode (for mobile development)
- Node.js (for web app)

### 1. Install Dependencies

```bash
cd flutter_app
flutter pub get
```

This will install:
- `web_socket_channel: ^2.4.0` - For Nostr relay connections
- All existing dependencies

### 2. Run the Flutter Mobile App

```bash
flutter run
```

The app will automatically:
- Initialize Nostr service
- Connect to 7 public Nostr relays
- Generate a keypair (or load existing one)
- Start listening for global messages

### 3. Test Nostr Functionality

#### Check Console Output
Look for these messages:
```
✅ Nostr service initialized - Global P2P enabled
🌐 Nostr connected - Public key: npub1...
```

#### Send a Test Message
1. Open the app
2. Navigate to a chat
3. Send a message
4. It will be broadcast via:
   - Local mesh (if peers nearby)
   - Nostr relays (global reach)

### 4. Verify Relay Connections

The app connects to these relays:
- wss://relay.damus.io
- wss://relay.nostr.band
- wss://nos.lol
- wss://relay.snort.social
- wss://relay.current.fyi
- wss://nostr.wine
- wss://relay.primal.net

Check the debug console for connection status.

---

## 📱 Mobile App Features

### Current Capabilities

#### ✅ Working Features:
- **Bluetooth BLE**: Discover and connect to nearby devices
- **WebRTC**: Peer-to-peer data channels
- **Nostr Protocol**: Global messaging via relays
- **Mesh Routing**: Multi-hop message forwarding
- **XC Economy**: Earn and spend XC tokens
- **Local Rooms**: Create and join local chat rooms

#### ⚠️ Stub/Planned Features:
- **WiFi Direct**: High-speed local P2P (see implementation plan)
- **Tor Routing**: Privacy-enhanced routing
- **Full Encryption**: End-to-end encryption with secp256k1

---

## 🌐 Web App

### Run the Web App

```bash
npm install
npm run dev
```

The web app has full feature parity with mobile for:
- WebRTC P2P
- Bluetooth Web API
- Nostr protocol
- Mesh routing
- XC economy

---

## 🔧 Development Workflow

### Testing Nostr Integration

#### 1. Test Local Messaging
```dart
// In your Flutter app
final nostr = NostrService();
await nostr.initialize();

// Send a test message
await nostr.sendDirectMessage(
  'recipient_pubkey',
  'Hello from XitChat!'
);
```

#### 2. Monitor Relay Events
```dart
nostr.events.listen((event) {
  print('Event type: ${event.keys.first}');
  print('Event data: ${event.values.first}');
});
```

#### 3. Check Your Public Key
```dart
final pubkey = await nostr.getPublicKey();
print('My Nostr pubkey: $pubkey');
```

### Testing Cross-Platform Communication

#### Web ↔ Mobile via Nostr
1. Run web app: `npm run dev`
2. Run mobile app: `flutter run`
3. Both will connect to same Nostr relays
4. Send messages from either platform
5. Verify receipt on the other platform

---

## 🐛 Troubleshooting

### Issue: Nostr relays not connecting

**Solution:**
- Check internet connection
- Verify firewall settings
- Try different relays
- Check console for WebSocket errors

### Issue: Messages not appearing

**Solution:**
- Verify Nostr service initialized
- Check event listeners are set up
- Verify recipient public key is correct
- Check relay connection status

### Issue: Build errors

**Solution:**
```bash
flutter clean
flutter pub get
flutter run
```

### Issue: WebSocket connection errors

**Solution:**
- Ensure `web_socket_channel` is in pubspec.yaml
- Run `flutter pub get`
- Check platform-specific permissions

---

## 📚 Code Examples

### Initialize Nostr Service
```dart
import 'package:xitchat_mobile/services/nostr_service.dart';

class MyApp extends StatefulWidget {
  @override
  _MyAppState createState() => _MyAppState();
}

class _MyAppState extends State<MyApp> {
  final NostrService _nostr = NostrService();
  
  @override
  void initState() {
    super.initState();
    _initNostr();
  }
  
  Future<void> _initNostr() async {
    final success = await _nostr.initialize();
    if (success) {
      print('Nostr ready!');
      
      // Listen to events
      _nostr.events.listen((event) {
        setState(() {
          // Update UI based on events
        });
      });
    }
  }
}
```

### Send Direct Message
```dart
Future<void> sendMessage(String recipientPubkey, String message) async {
  final success = await _nostr.sendDirectMessage(recipientPubkey, message);
  if (success) {
    print('Message sent via Nostr!');
  } else {
    print('Failed to send message');
  }
}
```

### Update Profile
```dart
Future<void> updateMyProfile() async {
  await _nostr.updateProfile(
    name: 'Alice',
    about: 'XitChat enthusiast',
    picture: 'https://example.com/avatar.jpg',
  );
}
```

---

## 🔐 Security Notes

### Current Implementation
⚠️ **Demo-grade cryptography** - Uses SHA256 for key generation

### Production Requirements
For production use, implement:

1. **Proper secp256k1 signing**
```yaml
dependencies:
  pointycastle: ^3.7.3
```

2. **NIP-04 encryption**
```yaml
dependencies:
  encrypt: ^5.0.1
```

3. **BIP39 key derivation**
```yaml
dependencies:
  bip39: ^1.0.6
  bip32: ^2.0.0
```

---

## 📊 Performance Tips

### Optimize Relay Connections
- Start with 3-5 relays (not all 7)
- Monitor connection quality
- Implement relay rotation
- Add connection pooling

### Reduce Battery Usage
- Implement smart polling
- Use WebSocket ping/pong
- Close idle connections
- Batch message sends

### Improve Message Delivery
- Implement retry logic
- Add message queuing
- Use multiple relays for redundancy
- Implement delivery receipts

---

## 🎯 Next Steps

### Immediate
1. ✅ Test Nostr integration
2. ✅ Verify relay connections
3. ✅ Test cross-platform messaging

### Short-term
4. Add production cryptography
5. Implement WiFi Direct (Android)
6. Add Multipeer Connectivity (iOS)

### Long-term
7. Add Tor routing
8. Implement PoW anti-spam
9. Full end-to-end encryption
10. Comprehensive testing

---

## 📖 Documentation

### Key Files
- `flutter_app/lib/services/nostr_service.dart` - Nostr implementation
- `flutter_app/WIFI_DIRECT_IMPLEMENTATION_PLAN.md` - WiFi Direct guide
- `IMPLEMENTATION_SUMMARY.md` - Overall progress
- `README.md` - Project overview

### External Resources
- [Nostr Protocol](https://github.com/nostr-protocol/nostr)
- [NIPs (Nostr Implementation Possibilities)](https://github.com/nostr-protocol/nips)
- [Flutter Documentation](https://flutter.dev/docs)
- [WebRTC Guide](https://webrtc.org/)

---

## 🤝 Contributing

### Report Issues
- Check existing issues first
- Provide detailed reproduction steps
- Include platform and version info

### Submit PRs
- Follow existing code style
- Add tests for new features
- Update documentation
- Test on multiple platforms

---

**Happy Meshing!** 🌐✨

For questions or support, check the documentation or open an issue.

