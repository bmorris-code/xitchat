// Simple Presence Beacon Server
// This is a lightweight, stateless presence coordination server
// It does NOT store messages, identities, or logs - only ephemeral presence

import { createServer } from 'http';
import * as WebSocket from 'ws';

interface PresencePeer {
  pubkey: string;
  name: string;
  handle: string;
  device: 'mobile' | 'desktop' | 'unknown';
  networks: string[];
  rooms: string[];
  lastSeen: number;
  ttl: number;
  signalStrength?: number;
  geohash?: string;
  capabilities: string[];
  // Mobile heartbeat flags
  immediate?: boolean;
  foreground?: boolean;
  background?: boolean;
  softOffline?: boolean;
}

interface PresenceStore {
  [pubkey: string]: PresencePeer;
}

class PresenceBeaconServer {
  private store: PresenceStore = {};
  private wss: WebSocket.WebSocketServer;
  private server: any;
  private cleanupInterval: any;

  constructor(port: number = 8444) {
    this.server = createServer(this.handleHttpRequest.bind(this));
    this.wss = new WebSocket.WebSocketServer({ server: this.server });
    this.setupWebSocket();
    
    this.server.listen(port, () => {
      console.log(`🗼 Presence Beacon Server running on port ${port}`);
      console.log(`🗼 HTTP API: http://localhost:${port}/api/presence`);
      console.log(`🗼 WebSocket: ws://localhost:${port}`);
    });

    // Start cleanup interval - more frequent for mobile reliability
    this.cleanupInterval = setInterval(() => this.cleanupExpiredPeers(), 15000); // 15 seconds
  }

  private setupWebSocket() {
    this.wss.on('connection', (ws) => {
      console.log('🗼 WebSocket client connected');

      ws.on('message', (data) => {
        try {
          const message = JSON.parse(data.toString());
          this.handleWebSocketMessage(ws, message);
        } catch (error) {
          console.error('Invalid WebSocket message:', error);
        }
      });

      ws.on('close', () => {
        console.log('🗼 WebSocket client disconnected');
      });
    });
  }

  private handleWebSocketMessage(ws: any, message: any) {
    switch (message.type) {
      case 'update':
        this.updatePresence(message.presence);
        this.broadcastToPeers(message);
        break;
      case 'nearby':
        const nearby = this.getNearbyPeers(message.geohash, message.limit || 50);
        ws.send(JSON.stringify({ type: 'nearby', peers: nearby }));
        break;
      default:
        console.log('Unknown WebSocket message type:', message.type);
    }
  }

  private handleHttpRequest(req: any, res: any) {
    const url = new URL(req.url, `http://${req.headers.host}`);
    
    // Enable CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
      res.writeHead(200);
      res.end();
      return;
    }

    if (!url.pathname.startsWith('/api/presence')) {
      res.writeHead(404);
      res.end('Not Found');
      return;
    }

    const path = url.pathname.replace('/api/presence', '') || '/';

    try {
      switch (req.method) {
        case 'GET':
          this.handleGetRequest(path, url, res);
          break;
        case 'POST':
          this.handlePostRequest(path, req, res);
          break;
        case 'DELETE':
          this.handleDeleteRequest(path, req, res);
          break;
        default:
          res.writeHead(405);
          res.end('Method Not Allowed');
      }
    } catch (error) {
      console.error('HTTP request error:', error);
      res.writeHead(500);
      res.end('Internal Server Error');
    }
  }

  private handleGetRequest(path: string, url: URL, res: any) {
    if (path === '/health') {
      res.writeHead(200);
      res.end(JSON.stringify({ status: 'healthy', peers: Object.keys(this.store).length }));
      return;
    }

    if (path === '/nearby') {
      const geohash = url.searchParams.get('geohash');
      const limit = parseInt(url.searchParams.get('limit') || '50');
      
      if (!geohash) {
        res.writeHead(400);
        res.end('Missing geohash parameter');
        return;
      }

      const nearby = this.getNearbyPeers(geohash, limit);
      res.writeHead(200);
      res.end(JSON.stringify({ peers: nearby }));
      return;
    }

    if (path === '/all') {
      const allPeers = Object.values(this.store);
      res.writeHead(200);
      res.end(JSON.stringify({ peers: allPeers }));
      return;
    }

    if (path === '/alive') {
      const now = Date.now();
      const alivePeers = Object.values(this.store).filter(peer => {
        return peer.lastSeen + (peer.ttl * 1000) > now;
      });
      res.writeHead(200);
      res.end(JSON.stringify({ 
        peers: alivePeers,
        total: alivePeers.length,
        timestamp: now
      }));
      return;
    }

    if (path.startsWith('/room/')) {
      const roomId = decodeURIComponent(path.replace('/room/', ''));
      const now = Date.now();
      
      // Get alive peers in this specific room
      const roomMembers = Object.values(this.store).filter(peer => {
        const isAlive = peer.lastSeen + (peer.ttl * 1000) > now;
        const isInRoom = peer.rooms.includes(roomId);
        return isAlive && isInRoom;
      });

      res.writeHead(200);
      res.end(JSON.stringify({
        roomId,
        peers: roomMembers,
        memberCount: roomMembers.length,
        timestamp: now
      }));
      return;
    }

    if (path === '/rooms') {
      const now = Date.now();
      const roomCounts: { [roomId: string]: number } = {};
      
      // Count alive members in each room
      Object.values(this.store).forEach(peer => {
        const isAlive = peer.lastSeen + (peer.ttl * 1000) > now;
        if (isAlive) {
          peer.rooms.forEach(roomId => {
            roomCounts[roomId] = (roomCounts[roomId] || 0) + 1;
          });
        }
      });

      const rooms = Object.entries(roomCounts)
        .map(([roomId, memberCount]) => ({ roomId, memberCount }))
        .sort((a, b) => b.memberCount - a.memberCount); // Sort by popularity

      res.writeHead(200);
      res.end(JSON.stringify({
        rooms,
        totalRooms: rooms.length,
        timestamp: now
      }));
      return;
    }

    res.writeHead(404);
    res.end('Not Found');
  }

  private async handlePostRequest(path: string, req: any, res: any) {
    if (path === '/') {
      const body = await this.parseRequestBody(req);
      
      if (body.action === 'update') {
        this.updatePresence(body.presence);
        this.broadcastToPeers(body);
        res.writeHead(200);
        res.end('OK');
        return;
      }

      if (body.action === 'clear') {
        this.clearPresence(body.pubkey);
        res.writeHead(200);
        res.end('OK');
        return;
      }

      res.writeHead(400);
      res.end('Invalid action');
      return;
    }

    res.writeHead(404);
    res.end('Not Found');
  }

  private handleDeleteRequest(path: string, req: any, res: any) {
    if (path.startsWith('/')) {
      const pubkey = path.replace('/', '');
      this.clearPresence(pubkey);
      res.writeHead(200);
      res.end('OK');
      return;
    }

    res.writeHead(404);
    res.end('Not Found');
  }

  private parseRequestBody(req: any): Promise<any> {
    return new Promise((resolve) => {
      let body = '';
      req.on('data', chunk => body += chunk);
      req.on('end', () => {
        try {
          resolve(JSON.parse(body));
        } catch {
          resolve({});
        }
      });
    });
  }

  private updatePresence(presence: PresencePeer) {
    // Handle mobile heartbeat flags
    const now = Date.now();
    
    if (presence.immediate) {
      console.log(`🗼 Immediate presence update: ${presence.handle} (${presence.device})`);
    } else if (presence.background) {
      console.log(`🗼 Background presence update: ${presence.handle} (${presence.device})`);
    } else {
      console.log(`🗼 Regular presence update: ${presence.handle} (${presence.device})`);
    }

    // Store the presence with current timestamp
    this.store[presence.pubkey] = {
      ...presence,
      lastSeen: now
    };

    // Broadcast to all connected WebSocket clients
    this.broadcastToPeers({
      action: 'update',
      presence: this.store[presence.pubkey],
      timestamp: now
    });
  }

  private clearPresence(pubkey: string) {
    if (this.store[pubkey]) {
      const peer = this.store[pubkey];
      delete this.store[pubkey];
      console.log(`🗼 Presence cleared: ${peer.handle}`);
    }
  }

  private getNearbyPeers(geohash: string, limit: number): PresencePeer[] {
    const now = Date.now();
    
    // First filter out expired peers (TTL-based filtering)
    const alivePeers = Object.values(this.store).filter(peer => {
      const isAlive = peer.lastSeen + (peer.ttl * 1000) > now;
      if (!isAlive) {
        console.log(`🗼 Filtering expired peer: ${peer.handle} (lastSeen: ${peer.lastSeen}, TTL: ${peer.ttl}s)`);
      }
      return isAlive;
    });

    console.log(`🗼 Found ${alivePeers.length} alive peers out of ${Object.keys(this.store).length} total`);

    // Group by geohash proximity
    const nearbyPeers = alivePeers.filter(peer => {
      // Filter by geohash proximity (first 3 characters = ~100km precision)
      if (peer.geohash && peer.geohash.substring(0, 3) === geohash.substring(0, 3)) {
        return true;
      }
      // Include peers without geohash (fallback for global visibility)
      return !peer.geohash;
    });

    // Sort by lastSeen (most recent first) and apply limit
    const sortedPeers = nearbyPeers
      .sort((a, b) => b.lastSeen - a.lastSeen)
      .slice(0, limit);

    console.log(`🗼 Returning ${sortedPeers.length} nearby peers for geohash ${geohash.substring(0, 3)}`);
    
    return sortedPeers;
  }

  private broadcastToPeers(message: any) {
    const broadcast = JSON.stringify({
      type: 'presence_update',
      presence: message.presence,
      timestamp: Date.now()
    });

    this.wss.clients.forEach((client: any) => {
      if (client.readyState === 1) { // WebSocket.OPEN
        client.send(broadcast);
      }
    });
  }

  private cleanupExpiredPeers() {
    const now = Date.now();
    const expiredPeers: string[] = [];
    const mobileGracePeriod = 30000; // 30 seconds grace for mobile

    Object.entries(this.store).forEach(([pubkey, peer]) => {
      const effectiveTtl = peer.device === 'mobile' ? peer.ttl + mobileGracePeriod : peer.ttl;
      const expiryTime = peer.lastSeen + (effectiveTtl * 1000);
      
      if (expiryTime <= now) {
        expiredPeers.push(pubkey);
        console.debug(`🗼 Expired peer removed: ${peer.handle} (device: ${peer.device}, lastSeen: ${new Date(peer.lastSeen).toISOString()})`);
      }
    });

    expiredPeers.forEach(pubkey => {
      const peer = this.store[pubkey];
      delete this.store[pubkey];
    });

    if (expiredPeers.length > 0) {
      console.log(`🗼 Cleanup removed ${expiredPeers.length} expired peers (${expiredPeers.length}/${Object.keys(this.store).length} total)`);
      
      // Broadcast cleanup to connected clients
      this.broadcastToPeers({
        type: 'cleanup',
        expiredPeers,
        timestamp: now
      });
    }
  }

  shutdown() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    this.wss.close();
    this.server.close();
    console.log('🗼 Presence Beacon Server shut down');
  }
}

// Start server if this file is run directly
if (require.main === module) {
  const server = new PresenceBeaconServer(8444);
  
  // Graceful shutdown
  process.on('SIGINT', () => {
    console.log('Shutting down Presence Beacon Server...');
    server.shutdown();
    process.exit(0);
  });
}

export { PresenceBeaconServer };
