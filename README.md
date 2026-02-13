# XitChat - Serverless Mesh Messaging

🔥 **Zero-server mesh messaging powered by nostr & bluetooth**

## 🚀 Quick Start

### Web App
```bash
npm run dev
```
Open http://localhost:3001

### Android App
Download [xitchat-v1.apk](/xitchat-v1.apk) (59MB)

### PWA Installation
Visit the web app and click "Install" in your browser

## ✨ Features

### 🌐 Mesh Networking
- **Bluetooth P2P**: Direct device-to-device connections
- **WiFi Direct**: Local network messaging without internet
- **Nostr Integration**: Global decentralized mesh network
- **Offline First**: Works completely without servers

### 🔒 Privacy & Security
- **End-to-End Encryption**: All messages encrypted
- **No Tracking**: Zero analytics or telemetry
- **Anonymous**: No registration required
- **Self-Destructing**: Messages auto-delete

### 📱 Cross-Platform
- **Web**: Modern browser support
- **Android**: Native APK with full permissions
- **PWA**: Installable web app
- **iOS**: Web app with PWA capabilities

## 🛠 Tech Stack

### Frontend
- **React 19**: Modern UI framework
- **TypeScript**: Type-safe development
- **TailwindCSS**: Utility-first styling
- **Capacitor**: Native mobile features

### Backend Services
- **Nostr**: Decentralized protocol
- **WebSocket**: Real-time signaling
- **Bluetooth**: Direct P2P connections
- **Service Worker**: Offline capabilities

### Deployment
- **Vercel**: Primary web hosting
- **Netlify**: Alternative hosting
- **GitHub Pages**: Static hosting
- **Self-hosted**: Docker support

## 📁 Project Structure

```
xitchat/
├── components/          # React components
│   ├── games/         # Mini games
│   ├── ChatHeader.tsx
│   ├── ChatInput.tsx
│   └── ChatList.tsx
├── services/           # Core services
│   ├── ablyWebRTC.ts
│   ├── bluetoothMesh.ts
│   ├── realTorService.ts
│   └── nostrService.ts
├── android/           # Android app
├── public/           # Static assets
├── Fixes/server/     # Signaling server
└── flutter_app/      # Flutter version
```

## 🎮 Mini Games
- **Snake Game**: Classic snake with multiplayer
- **Tic-Tac-Toe**: P2P tic-tac-toe
- **More coming soon**: Chess, Checkers, etc.

## 🔧 Development

### Prerequisites
- Node.js 18+
- Android Studio (for mobile)
- Git

### Setup
```bash
git clone https://github.com/yourusername/xitchat.git
cd xitchat
npm install
```

### Development Commands
```bash
npm run dev              # Start web dev server
npm run dev:server       # Start signaling server
npm run build            # Build for production
npm run preview          # Preview production build
npm run sync:android     # Sync to Android
npm run android          # Open Android Studio
```

### Environment Variables
```bash
GEMINI_API_KEY=your_gemini_key
GROQ_API_KEY=your_groq_key
```

## 📱 Mobile Development

### Android
```bash
npm run build:mobile
npm run sync:android
npm run android
```

### iOS
```bash
npm run build:mobile
npm run sync:ios
```

## 🌍 Deployment

### Vercel
```bash
npm run build
vercel --prod
```

### Netlify
```bash
npm run build
netlify deploy --prod --dir=dist
```

### Docker
```bash
docker build -t xitchat .
docker run -p 3000:3000 xitchat
```

## 🔗 API & Services

### WebSocket Signaling
- **Port**: 8443
- **Protocol**: WebSocket
- **Purpose**: Peer discovery and signaling

### Nostr Relays
- **Default**: wss://relay.damus.io
- **Backup**: wss://nos.lol
- **Custom**: Add your own relays

### Bluetooth Mesh
- **Protocol**: BLE
- **Range**: ~50m
- **Devices**: Unlimited connections

## 🐛 Troubleshooting

### Common Issues
1. **WebSocket Connection**: Ensure port 8443 is open
2. **Bluetooth**: Enable location services
3. **APK Install**: Allow "Unknown Sources"
4. **PWA**: Use HTTPS in production

### Debug Mode
```bash
# Enable debug logging
localStorage.setItem('debug', 'true')
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## 📄 License

MIT License - feel free to use, modify, and distribute

## 🙏 Acknowledgments

- **Nostr Protocol**: Decentralized messaging
- **Capacitor**: Native mobile features
- **React**: Modern UI framework
- **Vite**: Fast build tool

## 📞 Support

- **Issues**: [GitHub Issues](https://github.com/yourusername/xitchat/issues)
- **Discord**: [Join our community](https://discord.gg/xitchat)
- **Email**: support@xitchat.app

---

**Made with ❤️ for decentralized communication**
