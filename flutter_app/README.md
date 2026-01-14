# XitChat Mobile App

## Overview
Flutter mobile app for XitChat P2P mesh networking on Android and iOS devices.

## Features
- **Real P2P Mesh Networking**: WebRTC-based peer-to-peer communication
- **Local Discovery**: SharedPreferences-based signaling for cross-platform P2P
- **Native Mobile Integration**: Uses native WebRTC, Bluetooth, and WiFi APIs
- **Mesh Routing**: Multi-hop message routing through connected peers
- **Local Rooms**: Create and join local chat rooms
- **Real-time Communication**: Instant messaging and peer discovery

## Architecture
```
lib/
├── main.dart           # App entry point and main UI
├── models.dart          # Data models (MeshPeer, MeshMessage, LocalRoom)
├── p2p_service.dart     # Core P2P networking service
├── mesh_provider.dart    # State management with Provider
└── radar_view.dart      # Radar visualization UI
```

## Key Components

### FlutterP2PService
- **WebRTC Implementation**: Native WebRTC for mobile devices
- **SharedPreferences**: Cross-platform local storage for signaling
- **Peer Discovery**: Automatic peer discovery via local storage events
- **Message Routing**: Mesh network message forwarding
- **Room Management**: Local room creation and joining

### MeshProvider
- **State Management**: Provider pattern for reactive UI updates
- **Event Handling**: Listens to P2P service events
- **UI State**: Manages peers, rooms, and discovery mode

### MainScreen
- **Tab Interface**: Radar, Peers, Rooms, Settings
- **Real Mode Toggle**: Switch between real/simulated modes
- **Peer Management**: Connect, disconnect, and chat with peers

## Mobile-Specific Features

### Android
- **Bluetooth LE**: Native Bluetooth Low Energy support
- **WiFi Direct**: Direct device-to-device WiFi
- **Location Services**: Required for Bluetooth discovery
- **Background Mode**: Continue P2P when app is backgrounded

### iOS
- **Multipeer Connectivity**: Apple's native P2P framework
- **Core Bluetooth**: Native Bluetooth API integration
- **Background App**: Background P2P mesh maintenance

## Getting Started

### Prerequisites
- Flutter SDK 3.0+
- Android SDK API 21+
- iOS 11.0+

### Installation
```bash
cd flutter_app
flutter pub get
flutter run
```

### Permissions
- **Internet**: WebRTC signaling
- **Bluetooth**: Device discovery and communication
- **Location**: Required for Bluetooth on Android
- **WiFi**: Network state for P2P optimization

## Usage
1. **Enable Real Mode**: Toggle from Settings tab
2. **Discover Peers**: Automatic peer discovery starts
3. **Connect**: Tap on discovered peers to establish P2P connection
4. **Chat**: Send messages directly through mesh network
5. **Create Rooms**: Start local group chats

## Integration with Web App

The Flutter app uses the same P2P protocol as the web version:
- **Same Signaling**: SharedPreferences equivalent to localStorage
- **Same WebRTC**: Compatible peer connection logic
- **Same Message Format**: Mesh messages with routing support
- **Cross-Platform**: Web and mobile apps can communicate

## Development Notes
- Uses Provider for state management
- Material Design with dark theme
- Responsive design for mobile screens
- Native performance optimizations
- Background P2P capabilities
