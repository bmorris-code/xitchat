// Simple WebSocket Server for Local XitChat Testing
// Run with: node local-test-server.js

const WebSocket = require('ws');
const http = require('http');

// Create HTTP server for WebSocket upgrade
const server = http.createServer();
const wss = new WebSocket.Server({ server });

// Store connected clients
const clients = new Map();

console.log('🚀 Starting XitChat Local Test Server...');
console.log('📡 WebSocket server will run on ws://localhost:8080');

wss.on('connection', (ws, request) => {
  const clientId = generateClientId();
  const clientInfo = {
    id: clientId,
    ws: ws,
    name: null,
    handle: null,
    connected: new Date(),
    lastSeen: new Date()
  };

  clients.set(clientId, clientInfo);
  console.log(`👋 Client connected: ${clientId}`);

  // Send welcome message
  ws.send(JSON.stringify({
    type: 'welcome',
    clientId: clientId,
    message: 'Connected to XitChat local test server'
  }));

  // Send current peer list to new client
  const peerList = Array.from(clients.values())
    .filter(c => c.id !== clientId && c.name)
    .map(c => ({
      id: c.id,
      name: c.name,
      handle: c.handle,
      lastSeen: c.lastSeen
    }));

  if (peerList.length > 0) {
    ws.send(JSON.stringify({
      type: 'peer_list',
      peers: peerList
    }));
  }

  ws.on('message', (data) => {
    try {
      const message = JSON.parse(data);
      handleMessage(clientId, message);
    } catch (error) {
      console.error('Failed to parse message:', error);
    }
  });

  ws.on('close', () => {
    console.log(`👋 Client disconnected: ${clientId}`);
    
    // Notify other clients about disconnection
    broadcast(clientId, {
      type: 'peer_disconnected',
      from: clientId,
      timestamp: new Date().toISOString()
    });

    clients.delete(clientId);
  });

  ws.on('error', (error) => {
    console.error(`Client error (${clientId}):`, error);
  });
});

function handleMessage(fromClientId, message) {
  const client = clients.get(fromClientId);
  if (!client) return;

  client.lastSeen = new Date();

  switch (message.type) {
    case 'presence':
      // Update client info
      client.name = message.name;
      client.handle = message.handle;
      
      // Broadcast presence to other clients
      broadcast(fromClientId, {
        type: 'presence',
        from: fromClientId,
        name: message.name,
        handle: message.handle,
        timestamp: message.timestamp
      });
      break;

    case 'message':
      // Route message to specific recipient or broadcast
      if (message.to && message.to !== 'all') {
        // Send to specific recipient
        const recipient = clients.get(message.to);
        if (recipient && recipient.ws.readyState === WebSocket.OPEN) {
          recipient.ws.send(JSON.stringify(message));
          console.log(`📨 Message routed: ${fromClientId} → ${message.to}`);
        } else {
          console.log(`❌ Recipient not found: ${message.to}`);
        }
      } else {
        // Broadcast to all other clients
        broadcast(fromClientId, message);
        console.log(`📨 Message broadcast from ${fromClientId}`);
      }
      break;

    case 'heartbeat':
      // Update last seen and respond
      client.lastSeen = new Date();
      
      // Send heartbeat response
      if (client.ws.readyState === WebSocket.OPEN) {
        client.ws.send(JSON.stringify({
          type: 'heartbeat_response',
          timestamp: new Date().toISOString()
        }));
      }
      break;

    default:
      console.log(`Unknown message type: ${message.type}`);
  }
}

function broadcast(fromClientId, message) {
  clients.forEach((client, clientId) => {
    if (clientId !== fromClientId && client.ws.readyState === WebSocket.OPEN) {
      client.ws.send(JSON.stringify(message));
    }
  });
}

function generateClientId() {
  return Math.random().toString(36).substr(2, 9);
}

// Clean up inactive connections every 5 minutes
setInterval(() => {
  const now = new Date();
  clients.forEach((client, clientId) => {
    if (now - client.lastSeen > 5 * 60 * 1000) { // 5 minutes
      console.log(`🧹 Cleaning up inactive client: ${clientId}`);
      client.ws.terminate();
      clients.delete(clientId);
    }
  });
}, 5 * 60 * 1000);

// Start server
server.listen(8080, () => {
  console.log('✅ XitChat Local Test Server is running!');
  console.log('📡 WebSocket: ws://localhost:8080');
  console.log('🌐 Open your app in multiple browser windows to test');
  console.log('💬 Chat between windows should work immediately');
});

// Handle server shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down server...');
  wss.close(() => {
    server.close(() => {
      console.log('✅ Server stopped');
      process.exit(0);
    });
  });
});
