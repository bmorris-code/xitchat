// Bootstrap runtime for web/PWA (kept external to support strict CSP).
(function () {
  window.global = window;
  window.process = window.process || { env: { NODE_ENV: 'production' }, version: '' };

  window.onerror = function (msg, url, line, col) {
    console.error('Global Error:', msg, 'at', line, ':', col);
  };

  window.addEventListener('unhandledrejection', function (event) {
    var reason = event.reason ? (event.reason.message || event.reason.toString()) : '';
    if (
      reason.includes('rate-limited') ||
      reason.includes('slow down') ||
      reason.includes('connection timed out') ||
      reason.includes('publish timed out') ||
      reason.includes('timeout')
    ) {
      event.preventDefault();
      return;
    }
    console.warn('Unhandled Promise Rejection:', event.reason);
  });

  var isApp = window.Capacitor !== undefined;
  if ('serviceWorker' in navigator && !isApp) {
    window.addEventListener('load', function () {
      navigator.serviceWorker.register('/sw.js')
        .then(function () {
          console.log('PWA: Service Worker registered (Web Mode)');
        })
        .catch(function (error) {
          console.log('PWA: Registration failed:', error);
        });
    });
  } else if (isApp) {
    console.log('Native App Detected: Service Worker disabled to prevent conflicts');
  }

  document.addEventListener('DOMContentLoaded', function () {
    if (/(iPad|iPhone|iPod)/g.test(navigator.userAgent)) {
      document.body.style.display = 'none';
      setTimeout(function () {
        document.body.style.display = 'block';
      }, 0);
    }
    document.documentElement.style.webkitTextSizeAdjust = '100%';
    document.documentElement.style.webkitFontSmoothing = 'antialiased';
  });

  var resizeTimer;
  window.addEventListener('resize', function () {
    document.body.classList.add('resize-animation-stopper');
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(function () {
      document.body.classList.remove('resize-animation-stopper');
    }, 400);
  });

  // Debug: Check environment variables
  setTimeout(function() {
    console.log('=== XitChat Environment Debug ===');
    try {
      if (typeof import.meta !== 'undefined' && import.meta.env) {
        console.log('VITE_GROQ_API_KEY exists:', !!import.meta.env.VITE_GROQ_API_KEY);
        console.log('VITE_GROQ_API_KEY length:', import.meta.env.VITE_GROQ_API_KEY?.length || 0);
        console.log('VITE_GEMINI_API_KEY exists:', !!import.meta.env.VITE_GEMINI_API_KEY);
        console.log('VITE_ABLY_API_KEY exists:', !!import.meta.env.VITE_ABLY_API_KEY);
      } else {
        console.log('import.meta.env not available');
      }
    } catch (error) {
      console.log('import.meta check failed:', error.message);
      console.log('Environment variables not accessible in bootstrap.js');
    }
  }, 2000);
})();
