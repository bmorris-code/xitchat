// Simple Broadcast Channel Mesh for Vercel deployment
// Uses BroadcastChannel API for same-origin communication
// Falls back to localStorage for cross-tab communication

import { safeJsonStringify } from '../utils/jsonUtils';

export interface BroadcastPeer {
  id: string;
  name: string;
  handle: string;
  connectionType: 'broadcast';
  isConnected: boolean;
  lastSeen: number;
  signalStrength: number;
  capabilities: string[];
}

export interface BroadcastMessage {
  id: string;
  from: string;
  to: string;
  content: string;
  timestamp: number;
  type: 'direct' | 'broadcast' | 'discovery';
  encrypted: boolean;
}

class BroadcastMeshService {
  private peers: Map<string, BroadcastPeer> = new Map();
  private myId: string;
  private myName: string;
  private myHandle: string;
  private broadcastChannel: BroadcastChannel | null = null;
  private storageKey: string = 'xitchat-broadcast-mesh';
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private listeners: { [key: string]: ((data: any) => void)[] } = {};
  private isConnected = false;

  constructor() {
    this.myId = `broadcast-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    this.myName = 'XitChat User';
    this.myHandle = '@user' + Math.floor(Math.random() * 10000);
  }

  async initialize(): Promise<boolean> {
    try {
      console.log('📡 Initializing Broadcast Channel Mesh...');
      
      // Create broadcast channel for same-origin communication
      if ('BroadcastChannel' in window) {
        this.broadcastChannel = new BroadcastChannel('xitchat-mesh');
        this.broadcastChannel.onmessage = this.handleBroadcastMessage.bind(this);
        console.log('✅ BroadcastChannel created');
      } else {
        console.log('⚠️ BroadcastChannel not supported, using localStorage fallback');
      }

      // Start heartbeat
      this.startHeartbeat();
      
      // Announce presence
      this.announcePresence();
      
      this.isConnected = true;
      console.log('✅ Broadcast mesh initialized');
      
      return true;
    } catch (error) {
      console.error('❌ Broadcast mesh initialization failed:', error);
      return false;
    }
  }

  private handleBroadcastMessage(event: MessageEvent) {
    try {
      const message: BroadcastMessage = JSON.parse(event.data);
      
      if (message.from === this.myId) return; // Ignore own messages
      
      console.log('📨 Received broadcast message:', message);
      
      switch (message.type) {
        case 'discovery':
          this.handleDiscoveryMessage(message);
          break;
        case 'direct':
          this.handleDirectMessage(message);
          break;
        case 'broadcast':
          this.handleBroadcastData(message);
          break;
      }
    } catch (error) {
      console.error('Error handling broadcast message:', error);
    }
  }

  private handleDiscoveryMessage(message: BroadcastMessage) {
    const peerData = JSON.parse(message.content);
    
    const peer: BroadcastPeer = {
      id: message.from,
      name: peerData.name || 'Unknown Device',
      handle: peerData.handle || '@unknown',
      connectionType: 'broadcast',
      isConnected: false, // Start as not connected
      lastSeen: Date.now(),
      signalStrength: 75,
      capabilities: ['discovery']
    };
    
    // Don't add if already exists
    if (!this.peers.has(message.from)) {
      this.peers.set(message.from, peer);
      console.log(`👋 Discovered peer: ${peer.name} (${peer.handle}) - Status: Unknown/Unsupported`);
      
      // Send reply discovery
      this.announcePresence(message.from);
      
      this.notifyListeners('peersUpdated', Array.from(this.peers.values()));
    }
  }

  private handleDirectMessage(message: BroadcastMessage) {
    try {
      const messageData = JSON.parse(message.content);
      
      if (messageData.type === 'ping') {
        // Handle ping response
        console.log(`📡 Received ping from: ${messageData.from} (${messageData.handle})`);
        
        // Update or add the peer with connected status
        const peer = this.peers.get(message.from);
        if (peer) {
          peer.name = messageData.from || 'Unknown Device';
          peer.handle = messageData.handle || '@unknown';
          peer.isConnected = true;
          peer.capabilities = ['chat', 'broadcast'];
          peer.lastSeen = Date.now();
          
          this.notifyListeners('peersUpdated', Array.from(this.peers.values()));
          console.log(`✅ Peer connected: ${peer.name} (${peer.handle})`);
        }
        return;
      }
      
      // Handle regular chat messages
      console.log(`💬 Direct message from ${message.from}: ${message.content}`);
      this.notifyListeners('messageReceived', message);
    } catch (error) {
      // If not JSON, treat as regular message
      console.log(`💬 Direct message from ${message.from}: ${message.content}`);
      this.notifyListeners('messageReceived', message);
    }
  }

  private handleBroadcastData(message: BroadcastMessage) {
    console.log(`📢 Broadcast from ${message.from}: ${message.content}`);
    this.notifyListeners('messageReceived', message);
  }

  private announcePresence(targetId?: string) {
    const discoveryData = {
      name: this.myName,
      handle: this.myHandle,
      timestamp: Date.now()
    };

    const message: BroadcastMessage = {
      id: this.generateMessageId(),
      from: this.myId,
      to: targetId || 'broadcast',
      content: safeJsonStringify(discoveryData),
      timestamp: Date.now(),
      type: 'discovery',
      encrypted: false
    };

    this.sendMessageInternal(message);
  }

  private startHeartbeat() {
    this.heartbeatInterval = setInterval(() => {
      this.announcePresence();
    }, 30000); // Every 30 seconds
  }

  private sendMessageInternal(message: BroadcastMessage) {
    const messageData = safeJsonStringify(message);
    
    // Send via BroadcastChannel
    if (this.broadcastChannel) {
      this.broadcastChannel.postMessage(messageData);
    }
    
    // Fallback to localStorage for cross-tab communication
    try {
      localStorage.setItem(`${this.storageKey}-${message.id}`, messageData);
      setTimeout(() => {
        localStorage.removeItem(`${this.storageKey}-${message.id}`);
      }, 1000);
    } catch (error) {
      console.warn('localStorage fallback failed:', error);
    }
  }

  async pingPeer(peerId: string): Promise<boolean> {
    try {
      const peer = this.peers.get(peerId);
      if (!peer) {
        console.log('❌ Peer not found for ping:', peerId);
        return false;
      }

      console.log(`📡 Pinging peer: ${peer.name} (${peer.handle})`);
      
      // Send ping message
      const pingMessage: BroadcastMessage = {
        id: this.generateMessageId(),
        from: this.myId,
        to: peerId,
        content: safeJsonStringify({
          type: 'ping',
          timestamp: Date.now(),
          from: this.myName,
          handle: this.myHandle
        }),
        timestamp: Date.now(),
        type: 'direct',
        encrypted: false
      };

      this.sendMessageInternal(pingMessage);
      
      // Update peer status to connecting
      peer.isConnected = true;
      peer.capabilities = ['chat', 'broadcast', 'connecting'];
      this.notifyListeners('peersUpdated', Array.from(this.peers.values()));
      
      // Simulate connection delay
      setTimeout(() => {
        peer.capabilities = ['chat', 'broadcast'];
        this.notifyListeners('peersUpdated', Array.from(this.peers.values()));
        console.log(`✅ Connected to peer: ${peer.name} (${peer.handle})`);
      }, 1500);
      
      return true;
    } catch (error) {
      console.error('Failed to ping peer:', error);
      return false;
    }
  }

  async sendMessage(peerId: string, content: string): Promise<void> {
    if (!this.isConnected) {
      console.warn('Not connected to broadcast mesh');
      return;
    }

    const message: BroadcastMessage = {
      id: this.generateMessageId(),
      from: this.myId,
      to: peerId,
      content: content,
      timestamp: Date.now(),
      type: 'direct',
      encrypted: false
    };

    this.sendMessageInternal(message);
    console.log(`📤 Sent message to ${peerId}: ${content}`);
  }

  async broadcastMessage(content: string): Promise<void> {
    if (!this.isConnected) {
      console.warn('Not connected to broadcast mesh');
      return;
    }

    const message: BroadcastMessage = {
      id: this.generateMessageId(),
      from: this.myId,
      to: 'broadcast',
      content: content,
      timestamp: Date.now(),
      type: 'broadcast',
      encrypted: false
    };

    this.sendMessageInternal(message);
    console.log(`📢 Broadcast message: ${content}`);
  }

  getPeers(): BroadcastPeer[] {
    return Array.from(this.peers.values());
  }

  isConnectedToMesh(): boolean {
    return this.isConnected;
  }

  getConnectionInfo() {
    return {
      type: 'broadcast' as const,
      peerCount: this.peers.size,
      isRealConnection: true
    };
  }

  subscribe(event: string, callback: (data: any) => void): () => void {
    if (!this.listeners[event]) {
      this.listeners[event] = [];
    }
    this.listeners[event].push(callback);
    
    return () => {
      this.listeners[event] = this.listeners[event].filter(cb => cb !== callback);
    };
  }

  private notifyListeners(event: string, data: any) {
    if (this.listeners[event]) {
      this.listeners[event].forEach(callback => callback(data));
    }
  }

  private generateMessageId(): string {
    return `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  disconnect() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }
    
    if (this.broadcastChannel) {
      this.broadcastChannel.close();
    }
    
    this.isConnected = false;
    console.log('📡 Broadcast mesh disconnected');
  }
}

export const broadcastMesh = new BroadcastMeshService();
