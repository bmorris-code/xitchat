# XitChat Functions Documentation

## 📱 Core App Functions

### 🚀 App Initialization
- **App.tsx**: Main application entry point
- **index.tsx**: React DOM rendering
- **capacitor.config.ts**: Native app configuration

### 🎨 UI Components
- **ChatHeader.tsx**: Chat interface header with status
- **ChatInput.tsx**: Message input with encryption
- **ChatList.tsx**: Message list with real-time updates
- **BuzzView.tsx**: Main navigation and discovery

### 🎮 Games & Entertainment
- **SnakeGame.tsx**: Classic snake multiplayer game
- **TicTacToeGame.tsx**: P2P tic-tac-toe game

## 🔗 Network Services

### 🌐 Real-time Communication
- **ablyWebRTC.ts**: WebRTC signaling and peer connections
- **realtimeRadar.ts**: Device discovery and proximity detection
- **realOfflineMesh.ts**: Offline mesh networking

### 🔗 Decentralized Protocols
- **nostrService.ts**: Nostr protocol implementation
- **realTorService.ts**: TOR network integration
- **bluetoothMesh.ts**: Bluetooth P2P mesh networking

### 📡 Signaling & Discovery
- **geohashChannels.ts**: Location-based channel discovery
- **presenceBeacon.ts**: Device presence broadcasting

## 🛡 Security & Privacy

### 🔐 Encryption & Security
- **banking.ts**: Secure transaction handling
- **androidPermissions.ts**: Android permission management

### 🌍 Location Services
- **androidPermissions.ts**: GPS and location access
- **geohashChannels.ts**: Location-based features

## 🤖 AI & Intelligence

### 🧠 AI Services
- **hybridAI.ts**: Multi-provider AI integration
- **enhancedDirectAI.ts**: Direct AI communication

## 📱 Native Integration

### 📲 Mobile Features
- **androidPermissions.ts**: Android runtime permissions
- **iosPermissions.ts**: iOS permission handling (if applicable)

### 🔧 Platform Services
- **capacitor.config.ts**: Cross-platform native features
- **app-setup.js**: Mobile app initialization

## 🎯 Utility Functions

### 🔧 Core Utilities
- **jsonUtils.ts**: JSON parsing and validation
- **globalJsonSetup.ts**: Global configuration management

### 🌐 Network Utilities
- **network-monitor.js**: Network status monitoring
- **ios-diagnostic.js**: iOS device diagnostics

## 🎨 Styling & Assets

### 🎭 UI Styling
- **app-styles.css**: Global application styles
- **index.css**: Base CSS configuration
- **tailwind.config.js**: Tailwind CSS configuration

### 🖼 Images & Icons
- **icon-*.png**: App icons in various sizes
- **splash-*.png**: App splash screens
- **font-awesome/**: Icon library

## ⚙ Configuration Files

### 📦 Build Configuration
- **package.json**: Dependencies and scripts
- **vite.config.ts**: Vite build configuration
- **tsconfig.json**: TypeScript configuration
- **metro.config.js**: Metro bundler for React Native

### 🚀 Deployment Config
- **vercel.json**: Vercel deployment settings
- **netlify.toml**: Netlify deployment configuration
- **.vercelignore**: Files to exclude from Vercel

### 📱 Mobile Configuration
- **capacitor.config.ts**: Capacitor native app config
- **build-android.bat**: Android build script
- **build-android.sh**: Linux/Mac Android build

## 🧪 Testing & Development

### 🧪 Development Tools
- **test-mesh-connectivity.html**: Network testing interface
- **test-mesh-connectivity.js**: Connectivity test scripts
- **local-test-server.cjs**: Local development server

### 📝 Documentation
- **ANDROID_*.md**: Android deployment guides
- **DEPLOYMENT_*.md**: Deployment documentation
- **NETWORK_*.md**: Network configuration guides

## 🔄 Background Services

### 🏃‍♂️ Background Processes
- **presenceBeacon.ts**: Continuous device discovery
- **network-monitor.js**: Network status tracking
- **realtimeRadar.ts**: Real-time proximity detection

## 📊 Data Management

### 💾 Data Storage
- **localStorage**: Local message storage
- **IndexedDB**: Offline data persistence
- **Cache API**: Resource caching for PWA

## 🔧 Development Scripts

### 🛠 Build Scripts
- **build-native.bat**: Windows native build
- **build-native.sh**: Linux/Mac native build
- **prepare-assets.cjs**: Asset preparation script

### 🚀 Deployment Scripts
- **build-android.bat**: Android app build
- **build-android.sh**: Linux/Mac Android build

## 🎯 Specialized Features

### 🎮 Gaming Functions
- **SnakeGame.tsx**: Multiplayer snake game logic
- **TicTacToeGame.tsx**: P2P game state management

### 🔍 Discovery Functions
- **realtimeRadar.ts**: Device proximity detection
- **geohashChannels.ts**: Location-based channel matching

### 🤝 Connection Functions
- **ablyWebRTC.ts**: WebRTC peer connection setup
- **bluetoothMesh.ts**: Bluetooth device pairing
- **nostrService.ts**: Nostr event publishing/subscribing

## 📱 Platform-Specific

### 🤖 Android Functions
- **androidPermissions.ts**: Runtime permission requests
- **android/**: Native Android app source

### 🍎 iOS Functions
- **ios/**: Native iOS app source
- **ios-diagnostic.js**: iOS-specific diagnostics

### 🌐 Web Functions
- **index.html**: Main web app HTML
- **registerSW.js**: Service worker registration

## 🔄 Real-time Features

### ⚡ Live Updates
- **WebSocket connections**: Real-time messaging
- **Service Worker**: Background sync
- **Push notifications**: Incoming message alerts

### 📡 Mesh Networking
- **P2P connections**: Direct device communication
- **Relay messaging**: Nostr relay integration
- **Offline sync**: Message synchronization

---

**📝 Note**: This documentation covers all major functions and components. Each service is designed to work independently and together to provide a seamless mesh networking experience.
