// Broadcast Channel Mesh for XitChat
// BroadcastChannel for same-device, Nostr for cross-device

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
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private listeners: { [key: string]: ((data: any) => void)[] } = {};
  private isConnected = false;
  private readonly nostrPrefix = 'xitchat-broadcast-v1-';

  // ── FIX #1: store Nostr unsub so disconnect() can clean it up ──
  private nostrUnsub: (() => void) | null = null;

  // ── FIX #3: counter to throttle Nostr announces to every 60s ──
  private nostrAnnounceCounter = 0;

  private fallbackHandle(id: string): string {
    return `@${(id || 'peer').replace(/[^a-zA-Z0-9]/g, '').toLowerCase().slice(0, 8) || 'peer'}`;
  }

  private fallbackName(id: string): string {
    return `Peer ${(id || 'peer').replace(/[^a-zA-Z0-9]/g, '').slice(0, 8) || 'peer'}`;
  }

  constructor() {
    this.myId = `broadcast-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    this.myName = 'XitChat User';
    this.myHandle = '@user' + Math.floor(Math.random() * 10000);
  }

  async initialize(): Promise<boolean> {
    try {
      if ('BroadcastChannel' in window) {
        this.broadcastChannel = new BroadcastChannel('xitchat-mesh');
        this.broadcastChannel.onmessage = (event) => {
          this.handleIncomingRawMessage(event.data, 'local');
        };
      }

      this.setupNostrTransport();
      this.startHeartbeat();
      this.announcePresenceLocal();
      this.isConnected = true;
      return true;
    } catch (error) {
      console.error('❌ Broadcast mesh initialization failed:', error);
      return false;
    }
  }

  private setupNostrTransport() {
    // ── FIX #1: unsubscribe previous listener before re-subscribing ──
    if (this.nostrUnsub) { this.nostrUnsub(); this.nostrUnsub = null; }

    this.nostrUnsub = nostrService.subscribe('messageReceived', (message) => {
      if (message.content && message.content.startsWith(this.nostrPrefix)) {
        const rawData = message.content.replace(this.nostrPrefix, '');
        this.handleIncomingRawMessage(rawData, 'nostr');
      }
    });
  }

  private handleIncomingRawMessage(rawData: string, source: 'local' | 'nostr') {
    try {
      const message: BroadcastMessage = JSON.parse(rawData);
      if (message.from === this.myId) return;
      if (message.to !== 'broadcast' && message.to !== this.myId) return;

      switch (message.type) {
        case 'discovery': this.handleDiscoveryMessage(message); break;
        case 'direct': this.handleDirectMessage(message); break;
        case 'broadcast': this.handleBroadcastData(message); break;
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
        // Reply only via local channel to avoid Nostr storm
        this.announcePresenceLocal(message.from);
        this.notifyListeners('peersUpdated', Array.from(this.peers.values()));
        this.notifyListeners('peerFound', peer);
      } else {
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

  // ── FIX #3: split into local-only and Nostr announce ──
  private announcePresenceLocal(targetId?: string) {
    const discoveryData = { name: this.myName, handle: this.myHandle, timestamp: Date.now() };
    const message: BroadcastMessage = {
      id: this.generateMessageId(),
      from: this.myId,
      to: targetId || 'broadcast',
      content: safeJsonStringify(discoveryData),
      timestamp: Date.now(),
      type: 'discovery',
      encrypted: false
    };
    // Send via BroadcastChannel only (no Nostr)
    const messageData = safeJsonStringify(message);
    if (this.broadcastChannel) {
      try { this.broadcastChannel.postMessage(messageData); } catch {}
    }
  }

  private async announcePresenceNostr() {
    const discoveryData = { name: this.myName, handle: this.myHandle, timestamp: Date.now() };
    const message: BroadcastMessage = {
      id: this.generateMessageId(),
      from: this.myId,
      to: 'broadcast',
      content: safeJsonStringify(discoveryData),
      timestamp: Date.now(),
      type: 'discovery',
      encrypted: false
    };
    const messageData = safeJsonStringify(message);
    try {
      if (nostrService.isConnected()) {
        await nostrService.broadcastMessage(`${this.nostrPrefix}${messageData}`);
      }
    } catch {}
  }

  private startHeartbeat() {
    if (this.heartbeatInterval) clearInterval(this.heartbeatInterval);
    this.heartbeatInterval = setInterval(() => {
      // ── FIX #3: local announce every 15s, Nostr every 60s ──
      this.announcePresenceLocal();
      this.nostrAnnounceCounter++;
      if (this.nostrAnnounceCounter % 4 === 0) {
        this.announcePresenceNostr();
      }
      this.cleanupPeers();
    }, 15000);
  }

  private cleanupPeers() {
    const now = Date.now();
    let changed = false;
    this.peers.forEach((peer, id) => {
      if (now - peer.lastSeen > 60000) { this.peers.delete(id); changed = true; }
    });
    if (changed) this.notifyListeners('peersUpdated', Array.from(this.peers.values()));
  }

  private async sendMessageInternal(message: BroadcastMessage) {
    const messageData = safeJsonStringify(message);

    // 1. Send via local BroadcastChannel
    if (this.broadcastChannel) {
      try { this.broadcastChannel.postMessage(messageData); } catch {}
    }

    // 2. Send via Nostr (cross-device) — fire and forget
    try {
      if (nostrService.isConnected()) {
        await nostrService.broadcastMessage(`${this.nostrPrefix}${messageData}`);
      }
    } catch {}

    // ── FIX #2: removed localStorage fallback — it blocked the main thread
    // and provided no benefit over BroadcastChannel for same-device ──
  }

  async pingPeer(peerId: string): Promise<boolean> {
    if (!this.peers.get(peerId)) return false;
    this.announcePresenceLocal(peerId);
    return true;
  }

  async sendMessage(peerId: string, content: string): Promise<boolean> {
    if (!this.isConnected) return false;
    if (!this.peers.has(peerId)) {
      console.debug(`Broadcast direct send skipped; peer ${peerId} not known`);
      return false;
    }

    const message: BroadcastMessage = {
      id: this.generateMessageId(),
      from: this.myId,
      to: peerId,
      content,
      timestamp: Date.now(),
      type: 'direct',
      encrypted: false
    };

    await this.sendMessageInternal(message);
    return true;
  }

  async broadcastMessage(content: string): Promise<void> {
    if (!this.isConnected) return;

    const message: BroadcastMessage = {
      id: this.generateMessageId(),
      from: this.myId,
      to: 'broadcast',
      content,
      timestamp: Date.now(),
      type: 'broadcast',
      encrypted: false
    };

    await this.sendMessageInternal(message);
  }

  getPeers(): BroadcastPeer[] { return Array.from(this.peers.values()); }
  isConnectedToMesh(): boolean { return this.isConnected; }
  getConnectionInfo() { return { type: 'broadcast' as const, peerCount: this.peers.size, isRealConnection: true }; }

  subscribe(event: string, callback: (data: any) => void): () => void {
    if (!this.listeners[event]) this.listeners[event] = [];
    this.listeners[event].push(callback);
    return () => { this.listeners[event] = this.listeners[event].filter(cb => cb !== callback); };
  }

  private notifyListeners(event: string, data: any) {
    (this.listeners[event] || []).forEach(cb => cb(data));
  }

  private generateMessageId(): string {
    return `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  disconnect() {
    if (this.heartbeatInterval) { clearInterval(this.heartbeatInterval); this.heartbeatInterval = null; }
    // ── FIX #1: unsubscribe Nostr listener ──
    if (this.nostrUnsub) { this.nostrUnsub(); this.nostrUnsub = null; }
    // ── FIX #4: null out channel after closing ──
    if (this.broadcastChannel) { this.broadcastChannel.close(); this.broadcastChannel = null; }
    this.isConnected = false;
  }
}

export const broadcastMesh = new BroadcastMeshService();
