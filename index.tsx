import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

// Import global JSON setup to handle BigInt serialization
import './utils/globalJsonSetup';

// Import iOS fixes for Safari/PWA compatibility
import './ios-fixes';

// Reduce console noise in development
if (process.env.NODE_ENV === 'development') {
  // Filter out Ably transport warnings
  const originalWarn = console.warn;
  console.warn = (...args) => {
    const message = args.join(' ');
    if (message.includes('Ably:') && message.includes('Transport.onIdleTimerExpire')) {
      return; // Filter out Ably idle warnings
    }
    originalWarn.apply(console, args);
  };

  // Handle unhandled promise rejections (especially Nostr rate limits)
  window.addEventListener('unhandledrejection', (event) => {
    const message = event.reason?.message || event.reason || '';

    // Handle Nostr rate limit errors gracefully
    if (message.includes('rate-limited') || message.includes('slow down')) {
      console.debug('🕊️ Nostr rate limit detected, handling gracefully');
      event.preventDefault(); // Prevent the error from showing in console
      return;
    }

    // Log other unhandled rejections
    console.error('Unhandled promise rejection:', event.reason);
  });
}

// Import the PWA register function (Required for offline mode)
import { registerSW } from 'virtual:pwa-register';

// --- 1. THE "WHITE SCREEN" / MIME TYPE FIX ---
// This listens for the specific deployment error you were seeing.
// Instead of showing a red box, it silently reloads the app to get the new files.
window.addEventListener('error', (event) => {
  const message = event.message || '';
  const isChunkError =
    message.includes('Failed to fetch dynamically imported module') ||
    message.includes('Importing a module script failed') ||
    message.includes('text/html'); // The MIME type error

  if (isChunkError) {
    console.log('♻️ New version detected (Chunk Load Error). Reloading...');
    if (!sessionStorage.getItem('reload-lock')) {
      sessionStorage.setItem('reload-lock', 'true');
      setTimeout(() => sessionStorage.removeItem('reload-lock'), 5000);
      window.location.reload();
    }
    return; // Stop other error handlers
  }

  // Only log other errors to console, don't show red box in production
  console.error('GLOBAL ERROR:', event.error);
});

// --- 2. SILENCE UNCAUGHT PROMISE REJECTIONS (Rate Limiting) ---
// This catches the "rate-limited: slow down matey" errors from nostr-tools
window.addEventListener('unhandledrejection', (event) => {
  const reason = event.reason ? (event.reason.message || event.reason.toString()) : '';

  if (reason.includes('rate-limited') || reason.includes('slow down') || reason.includes('noting too much') || reason.includes('publish timed out')) {
    // Silence these specific errors as they are expected during high load
    event.preventDefault();
    console.debug('ℹ️ Suppressed rate-limit/timeout error:', reason);
    return;
  }

  console.error('UNHANDLED REJECTION:', event.reason);
});

console.log('Starting XitChat app...');

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

// Test with a minimal version of App to isolate the issue
const MinimalApp = () => {
  console.log('MinimalApp component rendering...');

  return (
    <div style={{ padding: '20px', color: '#00ff41', fontFamily: 'monospace', backgroundColor: '#020202', minHeight: '100vh' }}>
      <h1>XitChat</h1>
      <p>Minimal version is working!</p>
      <div style={{ marginTop: '20px' }}>
        <button style={{
          background: 'transparent',
          border: '1px solid #00ff41',
          color: '#00ff41',
          padding: '8px 16px',
          cursor: 'pointer'
        }}>
          Test Button
        </button>
      </div>
    </div>
  );
};

try {
  console.log('Creating React root...');

  // Check if root already exists to avoid multiple createRoot() calls
  let root = (rootElement as any)._reactRoot;
  if (!root) {
    root = ReactDOM.createRoot(rootElement);
    (rootElement as any)._reactRoot = root;
  }

  console.log('Rendering app...');
  root.render(
    <App />
  );
  console.log('App rendered successfully');
} catch (error) {
  console.error('Failed to render React app:', error);
  rootElement.innerHTML = `<div style="color: #ff3131; padding: 20px; font-family: monospace;">React Error: ${error.message}</div>`;
}