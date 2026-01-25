# XitChat Vercel Deployment Checklist

## ✅ Pre-Deployment Verification

### Configuration Files
- [x] `.env.local` exists with API keys (local development only)
- [x] `.gitignore` includes `*.local` (protects API keys)
- [x] `vercel.json` configured for SPA routing
- [x] `package.json` has `vercel-build` script
- [x] `vite.config.ts` configured for production builds

### Environment Variables to Add in Vercel Dashboard

**Required (for XitBot AI)**:
```
VITE_GEMINI_API_KEY=AIzaSyAb4UWCX-zaBexqJzhMU8Qzdg_W44rOYXQ
VITE_GROQ_API_KEY=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
```

**Optional (already in code, but can override)**:
```
VITE_APP_NAME=XitChat
VITE_ENABLE_BLUETOOTH=true
VITE_ENABLE_WEBRTC=true
VITE_MESH_ROOM=xitchat-mesh
```

**Optional (for Ably WebRTC - if you want to use it)**:
```
ABLY_API_KEY=0XyUmg.KAC1UQ:4HxrbKiaAWmzcMyMFiMWu74y3sHhA1KyZ3WBE2ixiSc
```

> **Note**: Since you're going zero-server, Ably is optional. You can skip it and rely on public STUN servers instead.

---

## 🚀 Deployment Steps

### Step 1: Add Environment Variables to Vercel

1. Go to [vercel.com/dashboard](https://vercel.com/dashboard)
2. Select your `xitchat` project
3. Click **Settings** → **Environment Variables**
4. Add each variable:
   - **Key**: `VITE_GEMINI_API_KEY`
   - **Value**: `AIzaSyAb4UWCX-zaBexqJzhMU8Qzdg_W44rOYXQ`
   - **Environments**: ✅ Production, ✅ Preview, ✅ Development
   - Click **Save**
5. Repeat for `VITE_GROQ_API_KEY`

### Step 2: Deploy

**Option A: Automatic (Recommended)**
```bash
# Just push to GitHub
git add .
git commit -m "Update: Zero-server configuration"
git push origin main
```
Vercel will auto-deploy when you push to GitHub.

**Option B: Manual via Vercel CLI**
```bash
# Install Vercel CLI (if not already)
npm i -g vercel

# Deploy
vercel --prod
```

**Option C: Manual Redeploy from Dashboard**
1. Go to Vercel Dashboard → Deployments
2. Click **⋯** on latest deployment
3. Click **Redeploy**

### Step 3: Verify Deployment

After deployment completes:

1. **Visit**: http://xitchat.vercel.app
2. **Check Console** (F12):
   - Should NOT see: "API key not configured"
   - Should NOT see: "VITE_GEMINI_API_KEY is undefined"
3. **Test XitBot**:
   - Open chat with XitBot
   - Send: "Hello"
   - Should get AI response within 2-3 seconds
4. **Test PWA**:
   - Click install icon in address bar
   - Install as PWA
   - Open installed app
5. **Test Offline Mode**:
   - Disconnect WiFi
   - App should still load (cached)
   - Try sending message (should queue)

---

## 🔍 Current Configuration Review

### ✅ What's Good

1. **API Keys Secured**: `.env.local` is in `.gitignore` (line 13: `*.local`)
2. **Build Script Ready**: `package.json` has `vercel-build: vite build`
3. **SPA Routing**: `vercel.json` redirects all routes to `index.html`
4. **PWA Configured**: `vite.config.ts` has PWA plugin with manifest
5. **Legacy Support**: `@vitejs/plugin-legacy` for older browsers
6. **Code Splitting**: Manual chunks for vendor, nostr, ably, capacitor

### ⚠️ Recommendations

1. **Remove Commented Server URL** (line 5 in `.env.local`):
   ```bash
   # VITE_SIGNALING_SERVER_URL=wss://your-websocket-server.railway.app
   ```
   Since you're zero-server, this is not needed. Can delete.

2. **Consider Removing Ably Dependency** (zero-server approach):
   - Currently using Ably for WebRTC signaling
   - Can replace with public STUN servers only
   - Saves API key management
   - More aligned with zero-server philosophy

3. **Add Build Test** before deploying:
   ```bash
   npm run build
   npm run preview
   ```
   This tests the production build locally.

---

## 🧪 Pre-Deployment Test (Local)

Run these commands to test before deploying:

```bash
# 1. Clean install
npm ci

# 2. Build for production
npm run build

# 3. Preview production build
npm run preview

# 4. Open http://localhost:4173
# 5. Test all features
```

**Test Checklist**:
- [ ] App loads without errors
- [ ] XitBot responds to messages
- [ ] Can send messages
- [ ] PWA manifest loads (check DevTools → Application → Manifest)
- [ ] Service worker registers (check DevTools → Application → Service Workers)
- [ ] Offline mode works (DevTools → Network → Offline checkbox)

---

## 🚨 Common Issues & Fixes

### Issue: "API key not configured"
**Fix**: Add environment variables in Vercel Dashboard, then redeploy

### Issue: "Failed to fetch dynamically imported module"
**Fix**: Already handled in `App.tsx` lines 78-105 (auto-reload on version mismatch)

### Issue: PWA not installing
**Fix**: 
- Check `public/pwa-192x192.png` and `public/pwa-512x512.png` exist
- Check manifest in DevTools → Application → Manifest
- Must be served over HTTPS (Vercel does this automatically)

### Issue: Service Worker not updating
**Fix**: 
- Clear cache: DevTools → Application → Storage → Clear site data
- Or use Incognito mode for testing

---

## 📊 Post-Deployment Monitoring

After deployment, monitor:

1. **Vercel Analytics** (free):
   - Go to Vercel Dashboard → Analytics
   - Check page views, unique visitors

2. **Error Tracking**:
   - Check browser console for errors
   - Vercel Dashboard → Logs (for build errors)

3. **Performance**:
   - Run Lighthouse audit (DevTools → Lighthouse)
   - Target: >90 Performance, >90 PWA score

---

## ✅ Final Checklist

Before you deploy:

- [ ] Environment variables added to Vercel Dashboard
- [ ] Local build test passed (`npm run build && npm run preview`)
- [ ] XitBot works in local preview
- [ ] `.env.local` is NOT committed to Git
- [ ] Latest code pushed to GitHub
- [ ] Ready to deploy!

---

## 🚀 Deploy Command

When ready, run:

```bash
# Option 1: Push to GitHub (auto-deploy)
git add .
git commit -m "feat: Zero-server deployment ready"
git push origin main

# Option 2: Vercel CLI
vercel --prod
```

---

## 🎉 Success Criteria

Deployment is successful when:

- ✅ http://xitchat.vercel.app loads without errors
- ✅ XitBot responds to messages
- ✅ PWA can be installed
- ✅ Offline mode works
- ✅ No console errors
- ✅ Lighthouse PWA score >90

---

**You're ready to deploy!** 🚀
