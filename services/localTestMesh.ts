// Local Test Mesh for XitChat - WebSocket based for testing between browsers
// Simulates mesh networking using WebSocket connections

export interface LocalMeshNode {
  id: string;
  name: string;
  handle: string;
  distance: number;
  lastSeen: number;
  signalStrength: number;
  isLocal: boolean;
}

export interface LocalMeshMessage {
  id: string;
  from: string;
  to: string;
  content: string;
  timestamp: number;
  type: 'direct' | 'broadcast';
  encrypted: boolean;
}

class LocalTestMeshService {
  private peers: Map<string, LocalMeshNode> = new Map();
  private isConnected = false;
  private listeners: { [key: string]: ((data: any) => void)[] } = {};
  private ws: WebSocket | null = null;
  private myId: string;
  private myName: string;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private heartbeatTimer: NodeJS.Timeout | null = null;

  constructor() {
    this.myId = this.generateUserId();
    this.myName = `Test User ${Math.floor(Math.random() * 1000)}`;
  }

  async initialize(): Promise<boolean> {
    try {
      console.log('🔗 Initializing Local Test Mesh...');
      
      // Always start with local simulation for immediate testing
      console.log('🧪 Starting local simulation mode for immediate testing...');
      this.startLocalSimulation();
      return true;
      
      // WebSocket connection code below for future use
      /*
      const wsUrl = this.getWebSocketUrl();
      console.log(`📡 Connecting to: ${wsUrl}`);
      
      this.ws = new WebSocket(wsUrl);
      
      this.ws.onopen = () => {
        console.log('✅ Connected to local mesh server');
        this.isConnected = true;
        this.startHeartbeat();
        this.emit('connected', { id: this.myId, name: this.myName });
        
        // Announce ourselves to the mesh
        this.announcePresence();
      };

      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          this.handleMessage(data);
        } catch (error) {
          console.error('Failed to parse message:', error);
        }
      };

      this.ws.onclose = () => {
        console.log('❌ Disconnected from mesh server');
        this.isConnected = false;
        this.emit('disconnected');
        this.scheduleReconnect();
      };

      this.ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        this.emit('error', error);
      };

      return true;
      */
    } catch (error) {
      console.error('❌ Local mesh initialization failed:', error);
      this.startLocalSimulation();
      return false;
    }
  }

  private getWebSocketUrl(): string {
    // Try to connect to local WebSocket server
    const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = location.hostname;
    const port = 8080; // WebSocket server port
    
    return `${protocol}//${host}:${port}/mesh`;
  }

  private startLocalSimulation(): void {
    console.log('🔄 Starting local simulation mode...');
    
    // Create multiple simulated peers for testing
    const simulatedPeers: LocalMeshNode[] = [
      {
        id: 'xitbot-peer',
        name: 'XitBot',
        handle: '@xitbot',
        distance: 2.5,
        lastSeen: Date.now(),
        signalStrength: 85,
        isLocal: true
      },
      {
        id: 'sarah-peer',
        name: 'Sarah',
        handle: '@sarah',
        distance: 3.1,
        lastSeen: Date.now(),
        signalStrength: 72,
        isLocal: true
      },
      {
        id: 'mianoo-peer',
        name: 'Mianoo',
        handle: '@mianoo',
        distance: 1.8,
        lastSeen: Date.now(),
        signalStrength: 91,
        isLocal: true
      },
      {
        id: 'jchen-peer',
        name: 'J Chen',
        handle: '@jchen',
        distance: 4.2,
        lastSeen: Date.now(),
        signalStrength: 68,
        isLocal: true
      }
    ];

    simulatedPeers.forEach(peer => {
      this.peers.set(peer.id, peer);
    });

    this.isConnected = true;
    
    console.log(`👋 Created ${simulatedPeers.length} simulated peers for testing:`);
    simulatedPeers.forEach(peer => {
      console.log(`  - ${peer.name} (${peer.handle}) - Signal: ${peer.signalStrength}%`);
    });
    
    this.emit('peersUpdated', Array.from(this.peers.values()));
    this.emit('connected', { id: this.myId, name: this.myName });

    // Simulate periodic peer updates
    setInterval(() => {
      this.updateSimulatedPeers();
    }, 15000); // Every 15 seconds
  }

  private updateSimulatedPeers(): void {
    this.peers.forEach((peer, id) => {
      if (id.startsWith('simulated-peer-')) {
        // Update signal strength and last seen
        peer.signalStrength = Math.max(60, Math.min(100, peer.signalStrength + (Math.random() - 0.5) * 10));
        peer.lastSeen = Date.now();
        peer.distance = Math.max(1, peer.distance + (Math.random() - 0.5) * 2);
      }
    });

    this.emit('peersUpdated', Array.from(this.peers.values()));
    console.log('🔄 Updated simulated peer signals');
  }

  private handleMessage(data: any): void {
    switch (data.type) {
      case 'presence':
        this.handlePresence(data);
        break;
      case 'message':
        this.handleChatMessage(data);
        break;
      case 'heartbeat':
        this.updatePeerHeartbeat(data.from);
        break;
      case 'peer_list':
        this.handlePeerList(data.peers);
        break;
    }
  }

  private handlePresence(data: any): void {
    const { from, name, handle } = data;
    
    if (from === this.myId) return; // Ignore self
    
    const peer: LocalMeshNode = {
      id: from,
      name: name || `User ${from.substr(0, 8)}`,
      handle: handle || `@${from.substr(0, 8)}`,
      distance: Math.random() * 10 + 1,
      lastSeen: Date.now(),
      signalStrength: Math.random() * 40 + 60,
      isLocal: true
    };

    this.peers.set(from, peer);
    console.log(`👋 Peer joined: ${peer.name} (${peer.handle})`);
    this.emit('peersUpdated', Array.from(this.peers.values()));
  }

  private handleChatMessage(data: any): void {
    const message: LocalMeshMessage = {
      id: data.id,
      from: data.from,
      to: data.to,
      content: data.content,
      timestamp: Date.now(),
      type: data.type,
      encrypted: data.encrypted || false
    };

    console.log(`📨 Message from ${data.from}: ${data.content}`);
    this.emit('messageReceived', message);
  }

  private handlePeerList(peers: any[]): void {
    peers.forEach(peerData => {
      if (peerData.id !== this.myId) {
        const peer: LocalMeshNode = {
          id: peerData.id,
          name: peerData.name,
          handle: peerData.handle,
          distance: Math.random() * 10 + 1,
          lastSeen: Date.now(),
          signalStrength: Math.random() * 40 + 60,
          isLocal: true
        };

        this.peers.set(peerData.id, peer);
      }
    });

    console.log(`📋 Updated peer list: ${this.peers.size} peers`);
    this.emit('peersUpdated', Array.from(this.peers.values()));
  }

  private updatePeerHeartbeat(peerId: string): void {
    const peer = this.peers.get(peerId);
    if (peer) {
      peer.lastSeen = Date.now();
      peer.signalStrength = Math.random() * 40 + 60;
    }
  }

  private announcePresence(): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;

    const presence = {
      type: 'presence',
      from: this.myId,
      name: this.myName,
      handle: `@test${this.myId.substr(0, 8)}`,
      timestamp: new Date().toISOString()
    };

    this.ws.send(JSON.stringify(presence));
  }

  private startHeartbeat(): void {
    this.heartbeatTimer = setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({
          type: 'heartbeat',
          from: this.myId,
          timestamp: new Date().toISOString()
        }));
      }
    }, 30000); // Every 30 seconds
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer) return;
    
    this.reconnectTimer = setTimeout(() => {
      console.log('🔄 Attempting to reconnect...');
      this.reconnectTimer = null;
      this.initialize();
    }, 5000);
  }

  async sendMessage(peerId: string, content: string): Promise<boolean> {
    try {
      // Handle mesh data messages differently
      if (typeof content === 'string' && content.includes('mesh_data')) {
        console.log(`📤 Handling mesh data message for ${peerId}`);
        
        // For mesh data, create a temporary peer if it doesn't exist
        if (!this.peers.has(peerId) && peerId !== 'me') {
          const tempPeer: LocalMeshNode = {
            id: peerId,
            name: `Mesh User ${peerId.substr(0, 8)}`,
            handle: `@${peerId.substr(0, 8)}`,
            distance: Math.random() * 10 + 1,
            lastSeen: Date.now(),
            signalStrength: Math.random() * 40 + 60,
            isLocal: true
          };
          
          this.peers.set(peerId, tempPeer);
          console.log(`👋 Created temporary mesh peer: ${tempPeer.name}`);
          this.emit('peersUpdated', Array.from(this.peers.values()));
        }
        
        // Simulate successful mesh data delivery
        setTimeout(() => {
          this.emit('messageSent', {
            id: this.generateMessageId(),
            from: this.myId,
            to: peerId,
            content: content,
            timestamp: Date.now(),
            type: 'direct',
            encrypted: false
          });
        }, 100);
        
        return true;
      }

      const message: LocalMeshMessage = {
        id: this.generateMessageId(),
        from: this.myId,
        to: peerId,
        content: content,
        timestamp: Date.now(),
        type: 'direct',
        encrypted: false
      };

      console.log(`📤 Sending message to ${peerId}: ${content}`);
      
      // Simulate message delivery
      setTimeout(() => {
        this.emit('messageSent', message);
        
        // Simulate reply from Alice, Bob, or Charlie
        if (peerId.startsWith('simulated-peer-')) {
          setTimeout(() => {
            this.simulateReply(peerId, content);
          }, 1000 + Math.random() * 2000);
        }
      }, 500);

      return true;
    } catch (error) {
      console.error('❌ Failed to send message:', error);
      return false;
    }
  }

  private simulateReply(peerId: string, originalMessage: string): void {
    const peer = this.peers.get(peerId);
    if (!peer) return;

    const replies = [
      "That's interesting! Tell me more.",
      "I agree with you!",
      "Cool! What else do you think about XitChat?",
      "Nice to meet you! How's the mesh network working?",
      "Awesome! The connection is pretty good today.",
      "Hey! I'm testing the chat too. Working great!",
      "Thanks for the message! Signal strength is good.",
      "Great to connect through the mesh!"
    ];

    const replyContent = replies[Math.floor(Math.random() * replies.length)];
    
    const replyMessage: LocalMeshMessage = {
      id: this.generateMessageId(),
      from: peerId,
      to: this.myId,
      content: replyContent,
      timestamp: Date.now(),
      type: 'direct',
      encrypted: false
    };

    console.log(`📨 Simulated reply from ${peer.name}: ${replyContent}`);
    this.emit('messageReceived', replyMessage);
  }

  getPeers(): LocalMeshNode[] {
    return Array.from(this.peers.values());
  }

  isConnectedToMesh(): boolean {
    return this.isConnected && this.peers.size > 0;
  }

  getConnectionInfo(): any {
    return {
      isRealConnection: this.isConnected,
      peerCount: this.peers.size,
      type: 'websocket',
      myId: this.myId,
      myName: this.myName,
      serverUrl: this.getWebSocketUrl(),
      isSimulation: !this.ws || this.ws.readyState !== WebSocket.OPEN
    };
  }

  private generateUserId(): string {
    return Math.random().toString(36).substr(2, 9);
  }

  private generateMessageId(): string {
    return Math.random().toString(36).substr(2, 9);
  }

  private emit(event: string, data?: any): void {
    const listeners = this.listeners[event] || [];
    listeners.forEach(callback => callback(data));
  }

  subscribe(event: string, callback: (data: any) => void): () => void {
    if (!this.listeners[event]) {
      this.listeners[event] = [];
    }
    this.listeners[event].push(callback);

    return () => {
      const listeners = this.listeners[event];
      const index = listeners.indexOf(callback);
      if (index > -1) {
        listeners.splice(index, 1);
      }
    };
  }

  disconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }

    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }

    this.isConnected = false;
    this.peers.clear();
    this.emit('disconnected');
    console.log('🔌 Local test mesh disconnected');
  }
}

export const localTestMesh = new LocalTestMeshService();
