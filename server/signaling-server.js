// WebRTC Signaling Server for XitChat Mesh
// Enables P2P connections between devices (iPhone, Desktop, Android)
// Simple WebSocket server for ICE candidate exchange

const WebSocket = require('ws');
const http = require('http');
const fs = require('fs');
const path = require('path');

// HTTP server for serving static files and client
const server = http.createServer((req, res) => {
  if (req.url === '/status') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(getStatus()));
  } else if (req.url === '/') {
    // Serve the signaling client
    const clientPath = path.join(__dirname, 'signaling-client.html');
    if (fs.existsSync(clientPath)) {
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(fs.readFileSync(clientPath));
    } else {
      res.writeHead(404);
      res.end('Signaling client not found');
    }
  } else {
    res.writeHead(404);
    res.end('Not found');
  }
});

// WebSocket server for signaling
const wss = new WebSocket.Server({ server });

// Store connected peers
const peers = new Map();
const rooms = new Map();

// WebSocket connection handler
wss.on('connection', (ws) => {
  console.log('New peer connected');
  
  // Generate peer ID
  const peerId = generatePeerId();
  peers.set(peerId, {
    ws,
    id: peerId,
    connected: new Date(),
    room: null
  });
  
  // Send peer ID to client
  ws.send(JSON.stringify({
    type: 'peer-id',
    peerId: peerId
  }));
  
  // Handle messages from peer
  ws.on('message', (data) => {
    try {
      const message = JSON.parse(data);
      handleMessage(peerId, message);
    } catch (error) {
      console.error('Invalid message format:', error);
    }
  });
  
  // Handle disconnection
  ws.on('close', () => {
    console.log(`Peer ${peerId} disconnected`);
    handleDisconnect(peerId);
  });
  
  // Handle errors
  ws.on('error', (error) => {
    console.error(`Peer ${peerId} error:`, error);
    handleDisconnect(peerId);
  });
});

function handleMessage(fromPeerId, message) {
  const peer = peers.get(fromPeerId);
  if (!peer) return;
  
  switch (message.type) {
    case 'join-room':
      handleJoinRoom(fromPeerId, message.roomId);
      break;
      
    case 'leave-room':
      handleLeaveRoom(fromPeerId);
      break;
      
    case 'offer':
    case 'answer':
    case 'ice-candidate':
      handleSignaling(fromPeerId, message);
      break;
      
    case 'list-peers':
      sendPeerList(fromPeerId);
      break;
      
    case 'broadcast':
      handleBroadcast(fromPeerId, message);
      break;
      
    default:
      console.log('Unknown message type:', message.type);
  }
}

function handleJoinRoom(peerId, roomId) {
  const peer = peers.get(peerId);
  if (!peer) return;
  
  // Leave current room if any
  if (peer.room) {
    handleLeaveRoom(peerId);
  }
  
  // Join new room
  peer.room = roomId;
  
  if (!rooms.has(roomId)) {
    rooms.set(roomId, new Set());
  }
  rooms.get(roomId).add(peerId);
  
  console.log(`Peer ${peerId} joined room ${roomId}`);
  
  // Notify room members
  broadcastToRoom(roomId, {
    type: 'peer-joined',
    peerId: peerId,
    timestamp: Date.now()
  }, peerId);
  
  // Send current room members to new peer
  const roomMembers = Array.from(rooms.get(roomId)).filter(id => id !== peerId);
  peer.ws.send(JSON.stringify({
    type: 'room-members',
    roomId: roomId,
    members: roomMembers
  }));
}

function handleLeaveRoom(peerId) {
  const peer = peers.get(peerId);
  if (!peer || !peer.room) return;
  
  const roomId = peer.room;
  rooms.get(roomId).delete(peerId);
  
  // Clean up empty rooms
  if (rooms.get(roomId).size === 0) {
    rooms.delete(roomId);
  }
  
  console.log(`Peer ${peerId} left room ${roomId}`);
  
  // Notify room members
  broadcastToRoom(roomId, {
    type: 'peer-left',
    peerId: peerId,
    timestamp: Date.now()
  });
  
  peer.room = null;
}

function handleSignaling(fromPeerId, message) {
  const peer = peers.get(fromPeerId);
  if (!peer || !peer.room) return;
  
  // Forward signaling message to target peer
  if (message.targetPeerId) {
    const targetPeer = peers.get(message.targetPeerId);
    if (targetPeer) {
      targetPeer.ws.send(JSON.stringify({
        ...message,
        fromPeerId: fromPeerId
      }));
    }
  } else {
    // Broadcast to room (for offer/answer)
    broadcastToRoom(peer.room, {
      ...message,
      fromPeerId: fromPeerId
    }, fromPeerId);
  }
}

function handleBroadcast(fromPeerId, message) {
  const peer = peers.get(fromPeerId);
  if (!peer || !peer.room) return;
  
  // Broadcast message to all peers in room
  broadcastToRoom(peer.room, {
    type: 'broadcast-message',
    fromPeerId: fromPeerId,
    content: message.content,
    timestamp: Date.now()
  }, fromPeerId);
}

function broadcastToRoom(roomId, message, excludePeerId = null) {
  const room = rooms.get(roomId);
  if (!room) return;
  
  room.forEach(peerId => {
    if (peerId !== excludePeerId) {
      const peer = peers.get(peerId);
      if (peer && peer.ws.readyState === WebSocket.OPEN) {
        peer.ws.send(JSON.stringify(message));
      }
    }
  });
}

function sendPeerList(peerId) {
  const peer = peers.get(peerId);
  if (!peer) return;
  
  const peerList = Array.from(peers.keys()).filter(id => id !== peerId);
  peer.ws.send(JSON.stringify({
    type: 'peer-list',
    peers: peerList
  }));
}

function handleDisconnect(peerId) {
  const peer = peers.get(peerId);
  if (!peer) return;
  
  // Leave room if in one
  if (peer.room) {
    handleLeaveRoom(peerId);
  }
  
  // Remove from peers
  peers.delete(peerId);
}

function generatePeerId() {
  return 'peer_' + Math.random().toString(36).substr(2, 9);
}

// Server status
function getStatus() {
  return {
    connectedPeers: peers.size,
    activeRooms: rooms.size,
    peers: Array.from(peers.values()).map(p => ({
      id: p.id,
      room: p.room,
      connected: p.connected
    })),
    rooms: Array.from(rooms.entries()).map(([id, members]) => ({
      id,
      memberCount: members.size
    }))
  };
}

// Status endpoint - removed duplicate handler

// Start server
const PORT = process.env.PORT || 8443;
server.listen(PORT, () => {
  console.log(`🔗 XitChat Signaling Server running on port ${PORT}`);
  console.log(`📊 Status: http://localhost:${PORT}/status`);
  console.log(`🌐 Client: http://localhost:${PORT}/`);
  console.log(`🔧 WebSocket: ws://localhost:${PORT}`);
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down signaling server...');
  wss.close(() => {
    server.close(() => {
      console.log('✅ Server stopped');
      process.exit(0);
    });
  });
});

module.exports = { server, wss, getStatus };
