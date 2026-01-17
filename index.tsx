import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

// Import global JSON setup to handle BigInt serialization
import './utils/globalJsonSetup';

// Import iOS fixes for Safari/PWA compatibility
import './ios-fixes';

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

// --- 2. SERVICE WORKER REGISTRATION (REQUIRED FOR PWA) ---
// This makes your app work offline and handle updates
const updateSW = registerSW({
  onNeedRefresh() {
    console.log('✨ New content available, updating...');
    updateSW(true); // Automatically update to the new version
  },
  onOfflineReady() {
    console.log('✅ App is ready for offline usage');
  },
  onRegisterError(error) {
    console.error('SW registration failed', error);
  },
});

console.log('Starting XitChat app...');

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

console.log('App rendered successfully');