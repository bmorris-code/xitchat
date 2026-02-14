# 📡 XitChat

<p align="center">
  <img src="https://raw.githubusercontent.com/bmorris-code/xitchat/main/public/icon.svg" width="128" height="128" alt="XitChat Logo">
</p>

<h3 align="center">Pure Mesh. No Servers. Just Chat.</h3>

<p align="center">
  <a href="https://github.com/bmorris-code/xitchat/actions/workflows/deploy.yml"><img src="https://github.com/bmorris-code/xitchat/actions/workflows/deploy.yml/badge.svg" alt="Build Status"></a>
  <img src="https://img.shields.io/badge/PRs-welcome-brightgreen.svg" alt="PRs Welcome">
  <img src="https://img.shields.io/badge/License-MIT-blue.svg" alt="License MIT">
  <img src="https://img.shields.io/badge/Powered_by-Nostr-8f00ff.svg" alt="Powered by Nostr">
</p>

---

**XitChat** is a decentralized, serverless mesh messaging platform designed for resilience, privacy, and community. Inspired by the nostalgia of Mxit and the technical capability of BitChat, XitChat leverages a 5-layer hybrid mesh to ensure you're never offline, even when the internet is.

## ✨ Features

- **🌐 5-Layer Hybrid Mesh**: Automatically switches between Bluetooth BLE, WiFi Direct, Nostr, WebRTC, and UDP Broadcast.
- **🔐 End-to-End Privacy**: NIP-04 encrypted messaging powered by Schnorr signatures and secp256k1.
- **� True Cross-Platform**: Run as a PWA, a Native Android App (Capacitor), or a standard Web App.
- **🤖 Mesh AI**: Access high-performance AI (Groq/Gemini) even when local nodes are offline via mesh-proxy relays.
- **💰 XC Economy**: A gamified chat experience with local "Joe Banker" bots and token-based incentives.
- **📡 Real-time Radar**: Discover nearby users and rooms using decentralized geohashing nodes.

## � Getting Started

### Prerequisites

- **Node.js** (v18 or newer)
- **NPM** or **Yarn**
- **Android Studio** (for mobile development)

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/bmorris-code/xitchat.git
   cd xitchat
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Setup environment variables:
   Create a `.env` file in the root:
   ```env
   VITE_GROQ_API_KEY=your_key_here
   VITE_GEMINI_API_KEY=your_key_here
   ```

4. Start the development server:
   ```bash
   npm run dev
   ```

## 📱 Mobile Deployment (Android)

XitChat uses Capacitor to provide a native Android experience with full hardware access.

```bash
# Build the web assets
npm run build:mobile

# Sync to Android project
npm run sync:android

# Open in Android Studio
npm run android
```

## � Tech Stack

- **Framework**: [React 19](https://react.dev/)
- **Build Tool**: [Vite 6](https://vitejs.dev/)
- **Native Bridge**: [Capacitor 6](https://capacitorjs.com/)
- **Mesh Logic**: Custom Hybrid Mesh Orchestrator
- **Cryptography**: [Noble Secp256k1](https://github.com/paulmillr/noble-secp256k1)
- **Styling**: Tailwind CSS with custom CRT filters

## � Documentation

For a deeper dive into the system architecture, network layer details, and implementation history, please see our [Comprehensive Technical Guide](./UNIFIED_XITCHAT_GUIDE.md).

## 🤝 Contributing

We love contributions! Whether it's a new mini-game, a network optimization, or a UI tweak, feel free to open a Pull Request.

1. Fork the Project
2. Create your Feature Branch (`git checkout -b feature/AmazingFeature`)
3. Commit your Changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the Branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## � License

Distributed under the MIT License. See `LICENSE` for more information.

---

<p align="center">
  Built with ❤️ by the XitChat Community
</p>
