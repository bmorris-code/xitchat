# APK Download Debug Guide

## 🔍 Debug Steps

### 1. Check APK File Exists
```bash
# In public directory
ls -la public/xitchat-v1.apk
# Should show: 179840673 bytes
```

### 2. Test Direct URL
Open in browser:
- Local: `http://localhost:3000/xitchat-v1.apk`
- Vercel: `https://your-app.vercel.app/xitchat-v1.apk`

### 3. Check Console Logs
Click download button and check console:
```
📱 Downloading APK from: http://localhost:3000/xitchat-v1.apk
```

### 4. Network Tab
Check browser Network tab for:
- URL requested
- Response headers
- Status code (should be 200)
- MIME type (should be `application/vnd.android.package-archive`)

## 🛠️ Common Issues

### Issue 1: 404 Not Found
**Problem**: APK not found
**Solution**: Check file exists in `public/` directory

### Issue 2: Wrong MIME Type
**Problem**: File served as `text/html`
**Solution**: Check `vercel.json` headers configuration

### Issue 3: CORS Issues
**Problem**: Cross-origin blocked
**Solution**: Use same-origin URLs (dynamic generation)

### Issue 4: Download Not Triggering
**Problem**: Click does nothing
**Solution**: Check browser console for JavaScript errors

## 📱 Android Installation

### Enable Unknown Sources
1. Settings → Security → Unknown Sources ✅
2. Settings → Apps → Special Access → Install Unknown Apps ✅

### Installation Steps
1. Download APK ✅
2. Open Downloads ✅
3. Tap APK file ✅
4. Grant permissions ✅
5. Install ✅

## 🚀 Test Checklist

- [ ] APK file exists in public directory
- [ ] Direct URL works in browser
- [ ] Console shows download URL
- [ ] Network tab shows 200 response
- [ ] Download starts on button click
- [ ] APK file size matches (179MB)
- [ ] Android can install the APK

## 🔧 If Still Not Working

1. **Check Vite dev server** is running
2. **Clear browser cache** and reload
3. **Try different browser** (Chrome, Firefox)
4. **Check Android device** storage permissions
5. **Test with smaller file** first
