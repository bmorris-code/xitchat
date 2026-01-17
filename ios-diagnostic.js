// iOS Safari/PWA Diagnostic Test
// Run this in browser console to identify iOS issues

function diagnoseIOSIssues() {
  console.log('🍎 iOS Safari/PWA Diagnostic Test');
  console.log('=====================================');
  
  // 1. Device Detection
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
  const isSafari = /Safari/.test(navigator.userAgent) && !/Chrome/.test(navigator.userAgent);
  const isPWA = window.matchMedia('(display-mode: standalone)').matches;
  const isIOSPWA = isPWA && isIOS;
  
  console.log('📱 Device Info:');
  console.log('  iOS:', isIOS);
  console.log('  Safari:', isSafari);
  console.log('  PWA:', isPWA);
  console.log('  iOS PWA:', isIOSPWA);
  console.log('  User Agent:', navigator.userAgent);
  
  // 2. Service Worker Status
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.getRegistrations().then(registrations => {
      console.log('🔧 Service Workers:', registrations.length);
      registrations.forEach((reg, index) => {
        console.log(`  SW ${index + 1}:`, {
          scope: reg.scope,
          state: reg.active?.state,
          installing: reg.installing?.state,
          waiting: reg.waiting?.state
        });
      });
    }).catch(err => console.error('🔧 SW Error:', err));
  } else {
    console.log('🔧 Service Workers: Not supported');
  }
  
  // 3. Memory Check
  if (performance && performance.memory) {
    const mem = performance.memory;
    console.log('🧠 Memory Usage:');
    console.log('  Used:', Math.round(mem.usedJSHeapSize / 1048576) + 'MB');
    console.log('  Total:', Math.round(mem.totalJSHeapSize / 1048576) + 'MB');
    console.log('  Limit:', Math.round(mem.jsHeapSizeLimit / 1048576) + 'MB');
  }
  
  // 4. CSS Support Check
  const testElement = document.createElement('div');
  const cssSupport = {
    grid: CSS.supports('display', 'grid'),
    flexbox: CSS.supports('display', 'flex'),
    customProperties: CSS.supports('--test', 'red'),
    safeAreas: CSS.supports('padding', 'env(safe-area-inset-top)')
  };
  console.log('🎨 CSS Support:', cssSupport);
  
  // 5. Console Errors (last 10)
  console.log('🐛 Recent Errors:');
  const errors = Array.from(document.querySelectorAll('.error')).slice(-10);
  errors.forEach((err, index) => {
    console.log(`  Error ${index + 1}:`, err.textContent);
  });
  
  // 6. React App Check
  const rootElement = document.getElementById('root');
  console.log('⚛️ React App:');
  console.log('  Root element exists:', !!rootElement);
  if (rootElement) {
    console.log('  Root children:', rootElement.children.length);
    console.log('  Root content:', rootElement.innerHTML.substring(0, 200) + '...');
  }
  
  // 7. Viewport Check
  const viewport = document.querySelector('meta[name="viewport"]');
  console.log('📱 Viewport:', viewport?.getAttribute('content'));
  
  console.log('=====================================');
  console.log('🍎 Diagnostic Complete');
  
  // 8. Recommendations
  console.log('💡 Recommendations:');
  if (isIOS && isSafari) {
    console.log('  • Try hard refresh: Cmd+Shift+R');
    console.log('  • Clear Safari cache: Settings > Safari > Clear History');
    console.log('  • Check console for JavaScript errors');
  }
  if (isIOSPWA) {
    console.log('  • Ensure PWA icons are in public folder');
    console.log('  • Check manifest.json paths');
  }
  
  return {
    isIOS,
    isSafari,
    isPWA,
    isIOSPWA,
    hasServiceWorker: 'serviceWorker' in navigator,
    memoryAvailable: !!(performance && performance.memory),
    cssSupport
  };
}

// Auto-run diagnostic
window.diagnoseIOSIssues = diagnoseIOSIssues;
console.log('🍎 iOS Diagnostic loaded. Run: diagnoseIOSIssues()');
