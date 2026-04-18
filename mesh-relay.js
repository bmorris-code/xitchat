#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════
// XitChat Local Mesh Relay — run on any device on the local network
// ═══════════════════════════════════════════════════════════════════
// This tiny WebSocket server lets a laptop browser and a mobile app
// exchange messages WITHOUT internet.  Both sides connect to this
// relay, and every message is forwarded to all other clients.
//
// USAGE
//   node mesh-relay.js            # starts on port 4200
//   node mesh-relay.js 9999       # starts on custom port
//
// Once running, the XitChat web-app/Capacitor-app auto-discover it
// on localhost:4200 or <your-LAN-IP>:4200.
// ═══════════════════════════════════════════════════════════════════

import { WebSocketServer, WebSocket } from 'ws';
import os from 'os';

const PORT = parseInt(process.argv[2], 10) || 4200;
const wss = new WebSocketServer({ port: PORT });

// Track connected clients
const clients = new Map(); // ws -> { id, handle, joinedAt }
let nextId = 1;

function broadcast(sender, data) {
  const raw = typeof data === 'string' ? data : JSON.stringify(data);
  wss.clients.forEach(client => {
    if (client !== sender && client.readyState === WebSocket.OPEN) {
      client.send(raw);
    }
  });
}

function broadcastPeerList() {
  const peers = Array.from(clients.values()).map(c => ({
    id: c.id,
    handle: c.handle,
    joinedAt: c.joinedAt
  }));
  const msg = JSON.stringify({ type: 'relay_peers', peers, timestamp: Date.now() });
  wss.clients.forEach(c => { if (c.readyState === WebSocket.OPEN) c.send(msg); });
}

wss.on('connection', (ws, req) => {
  const clientId = `relay-client-${nextId++}`;
  const ip = req.socket.remoteAddress || 'unknown';
  clients.set(ws, { id: clientId, handle: '@unknown', joinedAt: Date.now() });

  console.log(`\x1b[32m✓\x1b[0m Client connected: ${clientId} from ${ip}  (total: ${clients.size})`);

  // Send welcome with this client's assigned ID
  ws.send(JSON.stringify({
    type: 'relay_welcome',
    clientId,
    relayPort: PORT,
    timestamp: Date.now()
  }));

  // Broadcast updated peer list
  broadcastPeerList();

  ws.on('message', (raw) => {
    const text = raw.toString();

    // Try to parse and tag the message
    try {
      const parsed = JSON.parse(text);

      // Handle identity announce
      if (parsed.type === 'relay_identity') {
        const info = clients.get(ws);
        if (info) {
          info.handle = parsed.handle || info.handle;
          info.name = parsed.name || info.name;
          console.log(`  ↳ ${clientId} identified as ${info.handle}`);
          broadcastPeerList();
        }
        return;
      }

      // Relay everything else to all other clients
      broadcast(ws, text);
    } catch {
      // Not JSON — relay as-is
      broadcast(ws, text);
    }
  });

  ws.on('close', () => {
    const info = clients.get(ws);
    clients.delete(ws);
    console.log(`\x1b[31m✗\x1b[0m Client disconnected: ${info?.handle || clientId}  (total: ${clients.size})`);
    broadcastPeerList();
  });

  ws.on('error', (err) => {
    console.log(`  ⚠ Error from ${clientId}: ${err.message}`);
  });
});

wss.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`\x1b[31m✗\x1b[0m Port ${PORT} is already in use. Try: node mesh-relay.js ${PORT + 1}`);
  } else {
    console.error(`\x1b[31m✗\x1b[0m Server error:`, err.message);
  }
  process.exit(1);
});

// Print all LAN IPs for easy connection
const lanIPs = [];
const interfaces = os.networkInterfaces();
for (const name of Object.keys(interfaces)) {
  for (const iface of interfaces[name]) {
    if (iface.family === 'IPv4' && !iface.internal) {
      lanIPs.push({ name, address: iface.address });
    }
  }
}

console.log('');
console.log('═══════════════════════════════════════════════════════');
console.log('  \x1b[36mXitChat Local Mesh Relay\x1b[0m');
console.log('═══════════════════════════════════════════════════════');
console.log(`  Port:      \x1b[33m${PORT}\x1b[0m`);
console.log(`  Local:     \x1b[32mws://localhost:${PORT}\x1b[0m`);
lanIPs.forEach(ip => {
  console.log(`  Network:   \x1b[32mws://${ip.address}:${PORT}\x1b[0m  (${ip.name})`);
});
console.log('');
console.log('  In the XitChat app, go to Profile → Settings and');
console.log('  set the Mesh Relay URL to one of the addresses above.');
console.log('  Or the app will auto-discover localhost:4200.');
console.log('═══════════════════════════════════════════════════════');
console.log('');
console.log('Waiting for connections...');
