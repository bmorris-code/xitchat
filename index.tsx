import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

// Import global JSON setup to handle BigInt serialization
import './utils/globalJsonSetup';

class RootErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean; message: string }> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, message: error?.message || 'Unknown render error' };
  }

  componentDidCatch(error: Error) {
    console.error('Root render error:', error);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: '20px', color: '#ff3131', fontFamily: 'monospace', backgroundColor: 'black', minHeight: '100vh' }}>
          <h1 style={{ marginBottom: '8px' }}>XitChat startup error</h1>
          <p style={{ margin: 0 }}>{this.state.message}</p>
        </div>
      );
    }
    return this.props.children;
  }
}

// Reduce console noise in development
if (import.meta.env.DEV) {
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
    if (
      message.includes('rate-limited') ||
      message.includes('slow down') ||
      message.includes('connection timed out') ||
      message.includes('publish timed out') ||
      message.includes('timeout')
    ) {
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

  if (
    reason.includes('rate-limited') ||
    reason.includes('slow down') ||
    reason.includes('noting too much') ||
    reason.includes('publish timed out') ||
    reason.includes('connection timed out') ||
    reason.includes('timeout')
  ) {
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
    <div style={{ padding: '20px', color: 'black', fontFamily: 'monospace', backgroundColor: 'yellow', minHeight: '100vh' }}>
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
    <RootErrorBoundary>
      <App />
    </RootErrorBoundary>
  );
  console.log('App rendered successfully');
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error('Failed to render React app:', error);
  rootElement.innerHTML = `<div style="color: #ff3131; padding: 20px; font-family: monospace;">React Error: ${message}</div>`;
}

// Register service worker for PWA functionality
const updateSW = registerSW({
  onNeedRefresh() {
    // Optional: Show update available notification
    console.log('New content available, please refresh.');
  },
  onOfflineReady() {
    // Optional: Show offline ready notification
    console.log('App ready to work offline.');
  },
});
