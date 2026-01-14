# 🚀 XitChat System V - Deployment Guide

## 🌐 Live Intelligence Feed Features

XitChat now features a **Live Intelligence Feed** that uses Gemini 3 Pro with Google Search integration to provide real-time cybersecurity and mesh networking news. The app feels "alive" from the moment users open it.

### Key Features:
- **Real-time News**: Pulls trending technology and security news
- **Terminal Lens**: All content filtered through XitChat's cyberpunk aesthetic
- **Auto-refresh**: Updates every 5 minutes with latest intelligence
- **Relevance Scoring**: Content ranked by mesh network relevance

## 📱 PWA Installation

### iOS Safari
1. Open `https://your-app-url.vercel.app` in Safari
2. Tap **Share** button (square with arrow)
3. Select **"Add to Home Screen"**
4. Tap **"Add"** to install as native app

### Android Chrome
1. Open `https://your-app-url.vercel.app` in Chrome
2. Tap **Menu** (three dots)
3. Select **"Install app"** or **"Add to Home screen"**
4. Tap **"Install"** to confirm

## 🔧 Deployment Configuration

### Vercel Deployment
```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel --prod

# Set environment variable
vercel env add GEMINI_API_KEY
```

**Environment Variables:**
- `GEMINI_API_KEY`: Your Google Gemini API key

### Netlify Deployment
```bash
# Install Netlify CLI
npm i -g netlify-cli

# Build and deploy
npm run build
netlify deploy --prod --dir=dist

# Set environment variable
netlify env:set GEMINI_API_KEY "your-api-key"
```

## 🌐 Global Network Features

### Live Intelligence Feed
- **Google Search Grounding**: Real-world news via Gemini 3 Pro
- **Automatic Categorization**: Security, Technology, Mesh, Cybersecurity
- **Relevance Scoring**: 1-10 scale for mesh network users
- **Terminal Formatting**: URLs, IPs, and CVEs redacted for security

### Global Mesh Uplink
- **Visual Status Monitor**: 5-bar signal strength indicator
- **Connection Integrity**: Real-time packet activity display
- **Auto-status Updates**: Pulsing indicators for active transmissions
- **Mobile Optimized**: Compact status bars for mobile devices

### Cross-Node Handshake Persistence
- **localStorage Storage**: Handshakes persist across app installs
- **Integrity Scoring**: 0-100 based on connection reliability
- **Auto-cleanup**: Old nodes removed after 30 days
- **Background Maintenance**: Hourly integrity degradation

### Real-Time Transmission Toasts
- **Global Event System**: Listens for mesh and intelligence events
- **Custom Events**: Handshakes, new intelligence, system updates
- **Auto-dismiss**: 5-6 second timeout with manual dismiss
- **Stacking**: Shows up to 3 simultaneous transmissions

## 🔒 Security Features

### Content Filtering
- **URL Redaction**: `[URL_REDACTED]` for all external links
- **IP Protection**: `[IP_REDACTED]` for IP addresses
- **CVE Masking**: `[CVE_REDACTED]` for vulnerability IDs
- **Length Limits**: Content truncated to 150 characters

### PWA Security Headers
- **X-Frame-Options**: DENY
- **X-XSS-Protection**: 1; mode=block
- **Content-Type Options**: nosniff
- **Referrer Policy**: strict-origin-when-cross-origin

## 📊 Analytics & Monitoring

### Handshake Analytics
- Total nodes connected
- Active nodes (last 24h)
- Average integrity score
- Connection type distribution

### Intelligence Feed Stats
- Articles per category
- Relevance distribution
- Update frequency
- Source diversity

## 🎯 User Experience

### Installation Flow
1. User visits deployed URL
2. PWA manifest detected → "Install" prompt appears
3. Installation creates home screen icon
4. App opens in standalone mode (no browser bars)
5. Live intelligence loads immediately

### Real-Time Features
- **Immediate Activity**: Intelligence feed refreshes on app start
- **Background Updates**: New content every 5 minutes
- **Transmission Alerts**: Toast notifications for all events
- **Connection Monitoring**: Visual feedback for network health

## 🚀 Quick Deploy Commands

```bash
# Vercel (Recommended)
vercel --prod

# Netlify
netlify deploy --prod --dir=dist

# Custom domain setup
vercel domains add your-domain.com
```

## 📱 Mobile Optimization

### Responsive Design
- **Mobile-First**: Horizontal navigation on mobile
- **Touch Targets**: 44px minimum tap targets
- **Safe Areas**: iPhone notch and home indicator support
- **Performance**: Optimized for 3G networks

### PWA Features
- **Offline Support**: Basic functionality without internet
- **App Icons**: Complete 72px-512px icon set
- **Splash Screens**: Auto-generated for iOS devices
- **Theme Color**: #00ff41 (terminal green)

---

**XitChat System V** is now a truly living, breathing mesh network with real-world intelligence and persistent connections. Deploy to Vercel or Netlify to activate all features!
