// Simple Broadcast Channel Mesh for Vercel deployment
// Uses BroadcastChannel API for same-origin communication
// UPGRADED: Now uses Nostr for real-time cross-device communication

import { safeJsonStringify } from '../utils/jsonUtils';
import { nostrService } from './nostrService';

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
  private nostrPrefix = 'xitchat-broadcast-v1-';

  private fallbackHandle(id: string): string {
    const source = (id || 'peer').replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
    return `@${(source.slice(0, 8) || 'peer')}`;
  }

  private fallbackName(id: string): string {
    const source = (id || 'peer').replace(/[^a-zA-Z0-9]/g, '');
    return `Peer ${(source.slice(0, 8) || 'peer')}`;
  }

  constructor() {
    this.myId = `broadcast-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    this.myName = 'XitChat User';
    this.myHandle = '@user' + Math.floor(Math.random() * 10000);
  }

  async initialize(): Promise<boolean> {
    try {
      console.log('📡 Initializing Broadcast Channel Mesh (Cross-Device Enabled)...');

      // 1. Create broadcast channel for same-device communication
      if ('BroadcastChannel' in window) {
        this.broadcastChannel = new BroadcastChannel('xitchat-mesh');
        this.broadcastChannel.onmessage = (event) => {
          this.handleIncomingRawMessage(event.data, 'local');
        };
        console.log('✅ BroadcastChannel created');
      }

      // 2. Setup Nostr for cross-device communication
      this.setupNostrTransport();

      // Start heartbeat
      this.startHeartbeat();

      // Announce presence
      this.announcePresence();

      this.isConnected = true;
      console.log('✅ Broadcast mesh initialized with cross-device support');

      return true;
    } catch (error) {
      console.error('❌ Broadcast mesh initialization failed:', error);
      return false;
    }
  }

  private setupNostrTransport() {
    // Listen for broadcast mesh messages via Nostr
    nostrService.subscribe('messageReceived', (message) => {
      if (message.content && message.content.startsWith(this.nostrPrefix)) {
        const rawData = message.content.replace(this.nostrPrefix, '');
        this.handleIncomingRawMessage(rawData, 'nostr');
      }
    });
  }

  private handleIncomingRawMessage(rawData: string, source: 'local' | 'nostr') {
    try {
      const message: BroadcastMessage = JSON.parse(rawData);

      if (message.from === this.myId) return; // Ignore own messages

      // If it's a direct message, check if it's for us
      if (message.to !== 'broadcast' && message.to !== this.myId) return;

      console.log(`📨 Received ${source} broadcast message:`, message.type);

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
      console.error('Error handling raw broadcast message:', error);
    }
  }

  private handleDiscoveryMessage(message: BroadcastMessage) {
    try {
      const peerData = JSON.parse(message.content);

      const peer: BroadcastPeer = {
        id: message.from,
        name: peerData.name || this.fallbackName(message.from),
        handle: peerData.handle || this.fallbackHandle(message.from),
        connectionType: 'broadcast',
        isConnected: true,
        lastSeen: Date.now(),
        signalStrength: 100,
        capabilities: ['chat', 'broadcast']
      };

      if (!this.peers.has(message.from)) {
        this.peers.set(message.from, peer);
        console.log(`👋 Discovered cross-device peer: ${peer.name} (${peer.handle})`);

        // Reply to discovery
        this.announcePresence(message.from);

        this.notifyListeners('peersUpdated', Array.from(this.peers.values()));
        this.notifyListeners('peerFound', peer);
      } else {
        // Update existing peer
        const existing = this.peers.get(message.from)!;
        existing.lastSeen = Date.now();
        existing.isConnected = true;
      }
    } catch (e) {
      console.error('Failed to parse discovery content', e);
    }
  }

  private handleDirectMessage(message: BroadcastMessage) {
    this.notifyListeners('messageReceived', message);
  }

  private handleBroadcastData(message: BroadcastMessage) {
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
      this.cleanupPeers();
    }, 15000); // Every 15 seconds
  }

  private cleanupPeers() {
    const now = Date.now();
    let changed = false;
    this.peers.forEach((peer, id) => {
      if (now - peer.lastSeen > 60000) { // 1 minute timeout
        this.peers.delete(id);
        changed = true;
      }
    });
    if (changed) {
      this.notifyListeners('peersUpdated', Array.from(this.peers.values()));
    }
  }

  private async sendMessageInternal(message: BroadcastMessage) {
    const messageData = safeJsonStringify(message);

    // 1. Send via local BroadcastChannel (same-device)
    if (this.broadcastChannel) {
      this.broadcastChannel.postMessage(messageData);
    }

    // 2. Send via Nostr (cross-device)
    try {
      if (nostrService.isConnected()) {
        await nostrService.broadcastMessage(`${this.nostrPrefix}${messageData}`);
      }
    } catch (error) {
      // Silently fail for Nostr broadcast if not ready
      // console.warn('Nostr broadcast failed for mesh:', error); 
    }

    // 3. Fallback to localStorage (same-device fallback)
    try {
      localStorage.setItem(`${this.storageKey}-${message.id}`, messageData);
      setTimeout(() => {
        localStorage.removeItem(`${this.storageKey}-${message.id}`);
      }, 1000);
    } catch (error) {
      // ignore
    }
  }

  async pingPeer(peerId: string): Promise<boolean> {
    const peer = this.peers.get(peerId);
    if (!peer) return false;

    this.announcePresence(peerId);
    return true;
  }

  async sendMessage(peerId: string, content: string): Promise<void> {
    if (!this.isConnected) return;

    const message: BroadcastMessage = {
      id: this.generateMessageId(),
      from: this.myId,
      to: peerId,
      content: content,
      timestamp: Date.now(),
      type: 'direct',
      encrypted: false
    };

    await this.sendMessageInternal(message);
    console.log(`📤 Sent broadcast-mesh message to ${peerId}: ${content}`);
  }

  async broadcastMessage(content: string): Promise<void> {
    if (!this.isConnected) return;

    const message: BroadcastMessage = {
      id: this.generateMessageId(),
      from: this.myId,
      to: 'broadcast',
      content: content,
      timestamp: Date.now(),
      type: 'broadcast',
      encrypted: false
    };

    await this.sendMessageInternal(message);
    console.log(`📢 Broadcast mesh message: ${content}`);
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
