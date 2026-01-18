import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

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
  const root = ReactDOM.createRoot(rootElement);
  console.log('Rendering app...');
  root.render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
  console.log('App rendered successfully');
} catch (error) {
  console.error('Failed to render React app:', error);
  rootElement.innerHTML = `<div style="color: #ff3131; padding: 20px; font-family: monospace;">React Error: ${error.message}</div>`;
}