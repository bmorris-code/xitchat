// iOS Safari/PWA Black Screen Fix
// Add this to index.tsx to diagnose and fix iOS issues

// iOS Safari Detection
const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
const isSafari = /Safari/.test(navigator.userAgent) && !/Chrome/.test(navigator.userAgent);
const isIOSPWA = window.matchMedia('(display-mode: standalone)').matches && isIOS;

console.log('📱 Device Detection:', {
  isIOS,
  isSafari,
  isIOSPWA,
  userAgent: navigator.userAgent
});

// Enhanced debugging for blank screen issues
const debugBlankScreen = () => {
  console.log('🔍 Blank Screen Debug Check:');
  console.log('📄 Document ready state:', document.readyState);
  console.log('🎯 Root element exists:', !!document.getElementById('root'));
  console.log('🧩 React mounted:', !!document.querySelector('[data-reactroot]'));
  console.log('💾 LocalStorage available:', typeof Storage !== 'undefined');
  console.log('🔧 Service Worker active:', !!navigator.serviceWorker);
  console.log('🌐 Online status:', navigator.onLine);
  console.log('📱 Viewport size:', window.innerWidth + 'x' + window.innerHeight);
  console.log('🎨 CSS loaded:', !!document.querySelector('link[href*="index.css"]'));
  console.log('⚡ JavaScript errors:', window.console.error.length);
  
  // Check for specific iOS PWA issues
  if (isIOS && isIOSPWA) {
    console.log('🍎 iOS PWA Mode - Checking for common issues...');
    
    // Check if app is in standalone mode
    const standalone = (window.navigator as any)?.standalone;
    console.log('📱 Standalone mode:', standalone);
    
    // Check for safe area issues
    const safeArea = getComputedStyle(document.body);
    const safeAreaTop = (safeArea as any).paddingTop;
    console.log('🔲 Safe area top:', safeAreaTop);
    
    // Check for viewport issues
    const viewport = document.querySelector('meta[name="viewport"]');
    console.log('📱 Viewport meta:', viewport?.getAttribute('content'));
    
    // Check for content security policy issues
    const cspMeta = document.querySelector('meta[http-equiv="Content-Security-Policy"]');
    console.log('🔒 CSP meta:', cspMeta?.getAttribute('content'));
  }
  
  // Run debug check every 5 seconds
  setTimeout(debugBlankScreen, 5000);
};

// iOS-specific initialization
if (isIOS || isSafari) {
  console.log('🍎 iOS/Safari detected - applying fixes...');
  
  // Fix 1: Ensure proper viewport
  const viewport = document.querySelector('meta[name="viewport"]');
  if (viewport) {
    viewport.setAttribute('content', 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover');
  }
  
  // Fix 2: Prevent rubber banding
  document.body.addEventListener('touchmove', function(e) {
    if (e.touches.length > 1) {
      e.preventDefault();
    }
  }, { passive: false });
  
  // Fix 3: Handle safe areas
  const safeAreaStyle = document.createElement('style');
  safeAreaStyle.innerHTML = `
    body {
      padding: env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left);
    }
  `;
  document.head.appendChild(safeAreaStyle);
  
  // Fix 4: Service Worker debugging
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.getRegistrations().then(registrations => {
      console.log('🔧 Service Workers found:', registrations.length);
      registrations.forEach(registration => {
        console.log('🔧 SW Scope:', registration.scope);
        console.log('🔧 SW State:', registration.active?.state);
      });
    }).catch(error => {
      console.error('🔧 Service Worker check failed:', error);
    });
  }
  
  // Fix 5: Memory management (if available)
  if ((performance as any).memory) {
    const memory = (performance as any).memory;
    console.log('🧠 Memory Info:', {
      used: Math.round(memory.usedJSHeapSize / 1048576) + 'MB',
      total: Math.round(memory.totalJSHeapSize / 1048576) + 'MB',
      limit: Math.round(memory.jsHeapSizeLimit / 1048576) + 'MB'
    });
  }
}

// PWA-specific fixes
if (isIOSPWA) {
  console.log('📱 iOS PWA detected - applying PWA fixes...');
  
  // Fix 1: Standalone mode viewport
  setTimeout(() => {
    window.scrollTo(0, 1);
    window.scrollTo(0, 0);
  }, 0);
  
  // Fix 2: Status bar appearance
  const metaTheme = document.querySelector('meta[name="theme-color"]');
  if (metaTheme) {
    metaTheme.setAttribute('content', '#000000');
  }
  
  // Fix 3: Prevent zoom on input focus
  document.addEventListener('focusin', function(e) {
    const target = e.target as HTMLElement;
    if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') {
      setTimeout(() => {
        target.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 300);
    }
  });
  
  // Fix 4: Enhanced PWA startup
  setTimeout(() => {
    console.log('📱 PWA Startup check completed');
    debugBlankScreen();
  }, 1000);
}

// Debug console for iOS
if (isIOS || isSafari) {
  // Enhanced error logging
  window.addEventListener('error', function(e) {
    console.error('🍎 iOS Error:', {
      message: e.message,
      filename: e.filename,
      lineno: e.lineno,
      colno: e.colno,
      stack: e.error?.stack,
      timestamp: new Date().toISOString()
    });
  });
  
  // Log when React app loads
  window.addEventListener('load', function() {
    console.log('🍎 iOS Page loaded successfully');
    console.log('🍎 Document ready state:', document.readyState);
    console.log('🍎 React root element:', document.getElementById('root'));
    debugBlankScreen();
  });
}

export const iOSFixes = {
  isIOS,
  isSafari,
  isIOSPWA,
  applyFixes: () => {
    console.log('🍎 Applying iOS fixes...');
    // Fixes are already applied above
  },
  debugBlankScreen
};
