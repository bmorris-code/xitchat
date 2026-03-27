// Nostr Protocol Service for XitChat
// Implements decentralized global communication using Nostr relays

// CRITICAL: Import hash functions BEFORE nostr-tools to prevent "hashes.sha256 not set" error
import { sha256 } from '@noble/hashes/sha256';
import { hmac } from '@noble/hashes/hmac';

import * as nostrTools from 'nostr-tools';
import * as secp256k1 from '@noble/secp256k1';
import { networkStateManager, NetworkService } from './networkStateManager';
import { localStorageService } from './localStorageService';

if (typeof (secp256k1 as any).hashes !== 'undefined') {
  const hashes = (secp256k1 as any).hashes;
  const concatBytes = (secp256k1 as any).etc?.concatBytes;
  if (!hashes.sha256 && concatBytes) {
    hashes.sha256 = (...messages: Uint8Array[]) => sha256(concatBytes(...messages));
  }
  if (!hashes.hmacSha256 && concatBytes) {
    hashes.hmacSha256 = (key: Uint8Array, ...messages: Uint8Array[]) =>
      hmac(sha256, key, concatBytes(...messages));
  }
}

export interface NostrPeer {
  id: string;
  publicKey: string;
  name?: string;
  picture?: string;
  about?: string;
  nip05?: string;
  lastSeen: Date;
  isConnected: boolean;
}

export interface NostrMessage {
  id: string;
  pubkey: string;
  created_at: number;
  kind: number;
  tags: string[][];
  content: string;
  sig: string;
}

export interface NostrPresenceEvent {
  pubkey: string;
  device: 'mobile' | 'desktop' | 'server';
  role: 'edge' | 'anchor';
  caps: string[];
  rooms: string[];
  ttl: number;
  timestamp: number;
  geohash?: string;
  signalStrength?: number;
}

class NostrService {
  private pool: any = null;
  private privateKey: string | null = null;
  private publicKey: string | null = null;

  // ── FIX #2: cache key bytes — computed once, reused everywhere ──
  private privateKeyBytes: Uint8Array | null = null;

  private connectedRelays: Set<string> = new Set();
  private failedRelays: Set<string> = new Set();
  private peers: Map<string, NostrPeer> = new Map();
  private listeners: { [key: string]: ((data: any) => void)[] } = {};
  private isInitialized = false;

  // ── FIX #1: shared init promise to prevent concurrent initialize() races ──
  private initPromise: Promise<boolean> | null = null;

  // ── FIX #3: track subscriptions so they can be closed on re-init ──
  private eventSubscription: any = null;
  private presenceSubscription: any = null;

  private serviceInfo: NetworkService = {
    name: 'nostr',
    isConnected: false,
    isHealthy: false,
    lastCheck: 0,
    reconnectAttempts: 0,
    maxReconnectAttempts: 5,
    reconnectDelay: 3000
  };

  private readonly defaultRelays = [
    'wss://nos.lol',
    'wss://relay.snort.social',
    'wss://relay.primal.net',
    'wss://nostr.bitcoiner.social',
    'wss://nostr.mom'
  ];

  private readonly PRESENCE_KIND = 30315;

  public isConnected(): boolean {
    return this.isInitialized && this.connectedRelays.size > 0;
  }

  private getQueryRelays(): string[] {
    const connected = Array.from(this.connectedRelays);
    return connected.length > 0 ? connected : this.defaultRelays;
  }

  private getPublishRelays(): string[] {
    return Array.from(this.connectedRelays);
  }

  private isValidHexPubkey(value: string): boolean {
    return /^[0-9a-f]{64}$/i.test(value);
  }

  private isValidNpub(value: string): boolean {
    if (!/^npub1[qpzry9x8gf2tvdw0s3jn54khce6mua7l]+$/i.test(value)) return false;
    try {
      const decoded = nostrTools.nip19.decode(value as any);
      return (decoded.type as unknown as string) === 'npub' &&
        typeof decoded.data === 'string' &&
        this.isValidHexPubkey(decoded.data);
    } catch { return false; }
  }

  isValidRecipientKey(value: string): boolean {
    if (!value || typeof value !== 'string') return false;
    if (this.isValidHexPubkey(value)) return true;
    if (value.startsWith('npub')) return this.isValidNpub(value);
    return false;
  }

  // ── FIX #1: initialize() returns the shared in-flight promise ────────────
  async initialize(privateKey?: string): Promise<boolean> {
    if (this.isInitialized) return true;
    if (this.initPromise) return this.initPromise; // share in-flight promise

    this.initPromise = this._doInitialize(privateKey).finally(() => {
      this.initPromise = null;
    });
    return this.initPromise;
  }

  private async _doInitialize(privateKey?: string): Promise<boolean> {
    try {
      if (privateKey) {
        this.privateKey = privateKey;
      } else {
        const savedKey = await localStorageService.retrieveData('nostr_key');
        if (savedKey && savedKey.length === 64) {
          this.privateKey = savedKey;
        } else {
          const secretKey = new Uint8Array(32);
          crypto.getRandomValues(secretKey);
          this.privateKey = Array.from(secretKey)
            .map((b: number) => (b < 16 ? '0' : '') + b.toString(16))
            .join('');
          await localStorageService.storeData('nostr_key', this.privateKey);
        }
      }

      // ── FIX #2: compute key bytes once here ──────────────────────────────
      const cleanHex = this.privateKey!.replace(/^0x/i, '');
      this.privateKeyBytes = new Uint8Array(
        cleanHex.match(/.{1,2}/g)!.map(byte => parseInt(byte, 16))
      );

      const publicKeyBytes = secp256k1.getPublicKey(this.privateKeyBytes);
      const finalPubKey = publicKeyBytes.length === 33
        ? publicKeyBytes.slice(1)
        : publicKeyBytes;
      this.publicKey = Array.from(finalPubKey)
        .map((b: number) => (b < 16 ? '0' : '') + b.toString(16))
        .join('');

      this.pool = new nostrTools.SimplePool();
      await this.connectToRelays();
      await this.loadUserProfile();

      // ── FIX #3: close stale subscriptions before re-subscribing ──────────
      this.closeSubscriptions();

      await this.subscribeToEvents();
      await this.subscribeToPresenceEvents();

      this.serviceInfo.healthCheck = async () => this.isConnected();
      this.serviceInfo.reconnect = async () => {
        this.isInitialized = false;
        return await this.initialize();
      };

      networkStateManager.registerService(this.serviceInfo);
      this.isInitialized = true;
      this.serviceInfo.isConnected = true;
      this.serviceInfo.isHealthy = true;
      networkStateManager.updateServiceStatus('nostr', true, true);

      this.emit('initialized', { publicKey: this.publicKey });
      return true;
    } catch (error) {
      console.warn('⚠️ Nostr init failed:', error);
      return false;
    }
  }

  // ── FIX #3: close subscriptions helper ───────────────────────────────────
  private closeSubscriptions(): void {
    if (this.eventSubscription) {
      try { this.eventSubscription.close(); } catch {}
      this.eventSubscription = null;
    }
    if (this.presenceSubscription) {
      try { this.presenceSubscription.close(); } catch {}
      this.presenceSubscription = null;
    }
  }

  private async connectToRelays(): Promise<void> {
    this.connectedRelays.clear();
    this.failedRelays.clear();

    const connectionPromises = this.defaultRelays.map(async (relayUrl) => {
      try {
        await Promise.race([
          this.pool!.ensureRelay(relayUrl),
          new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 8000))
        ]);
        this.connectedRelays.add(relayUrl);
      } catch (error) {
        this.failedRelays.add(relayUrl);
        console.debug(`📡 Relay connection failed: ${relayUrl}`, error);
      }
    });

    await Promise.allSettled(connectionPromises);
  }

  private async loadUserProfile(): Promise<void> {
    try {
      const events = await this.pool!.querySync(
        this.getQueryRelays(),
        { kinds: [0], authors: [this.publicKey!], limit: 1 }
      );
      if (events.length > 0) this.emit('profileLoaded', JSON.parse(events[0].content));
    } catch {}
  }

  private async subscribeToEvents(): Promise<void> {
    const activeRelays = Array.from(this.connectedRelays);
    if (activeRelays.length === 0) return;

    // ── FIX #3: store subscription reference ──
    this.eventSubscription = this.pool!.subscribeMany(
      activeRelays,
      [
        { kinds: [4], '#p': [this.publicKey!], limit: 10 },
        { kinds: [1], '#t': ['xitchat'], limit: 10 },
        { kinds: [42], limit: 20 }
      ],
      {
        onevent: (event: any) => {
          if (event.kind === 4) this.handleDirectMessage(event);
          else if (event.kind === 1) this.handleTaggedTextNote(event);
          else if (event.kind === 42) this.emit('channelMessageReceived', event);
        },
        onclose: (reasons: any) => {
          console.debug('📡 Nostr subscription closed:', reasons);
        }
      }
    );
  }

  private async handleDirectMessage(event: any): Promise<void> {
    try {
      const decrypted = await nostrTools.nip04.decrypt(
        this.privateKey!,
        event.pubkey,
        event.content
      );
      this.emit('messageReceived', {
        id: event.id,
        from: event.pubkey,
        content: decrypted,
        timestamp: new Date(event.created_at * 1000),
        type: 'direct'
      });
    } catch {}
  }

  private handleTaggedTextNote(event: any): void {
    if (event.pubkey === this.publicKey) return;
    this.emit('messageReceived', {
      id: event.id,
      from: event.pubkey,
      content: event.content,
      timestamp: new Date(event.created_at * 1000),
      type: 'broadcast'
    });
  }

  // ── FIX #2: all send methods use this.privateKeyBytes — no recomputation ──

  async sendDirectMessage(recipientPublicKey: string, content: string): Promise<boolean> {
    try {
      if (!this.privateKeyBytes || !this.pool || this.connectedRelays.size === 0) {
        console.warn('⚠️ Cannot send Nostr DM: Not ready');
        return false;
      }

      if (recipientPublicKey.startsWith('npub')) {
        const decoded = nostrTools.nip19.decode(recipientPublicKey as any);
        if ((decoded.type as unknown as string) === 'npub')
          recipientPublicKey = decoded.data as unknown as string;
      }

      const encrypted = await nostrTools.nip04.encrypt(
        this.privateKey!,
        recipientPublicKey,
        content
      );
      const event = nostrTools.finalizeEvent(
        { kind: 4, created_at: Math.floor(Date.now() / 1000), tags: [['p', recipientPublicKey]], content: encrypted },
        this.privateKeyBytes
      );

      try {
        await this.pool!.publish(this.getPublishRelays(), event);
        return true;
      } catch (publishError: any) {
        if (this.isRelayPolicyError(publishError)) {
          console.warn('⚠️ Some relays rejected DM (policy) - may still be delivered');
          return true;
        }
        throw publishError;
      }
    } catch (error) {
      console.error('❌ Failed to send Nostr DM:', error);
      return false;
    }
  }

  async broadcastMessage(content: string): Promise<boolean> {
    try {
      if (!this.privateKeyBytes || !this.pool || this.connectedRelays.size === 0) {
        console.warn('⚠️ Cannot broadcast: Not ready');
        return false;
      }

      const event = nostrTools.finalizeEvent(
        { kind: 1, created_at: Math.floor(Date.now() / 1000), tags: [['t', 'xitchat']], content },
        this.privateKeyBytes
      );

      try {
        await this.pool!.publish(this.getPublishRelays(), event);
        return true;
      } catch (publishError: any) {
        if (this.isRelayPolicyError(publishError)) {
          console.warn('⚠️ Some relays rejected broadcast (policy)');
          return true;
        }
        throw publishError;
      }
    } catch (error) {
      console.error('❌ Failed to broadcast Nostr message:', error);
      return false;
    }
  }

  async publishChannelMessage(channelId: string, content: string): Promise<boolean> {
    try {
      if (!this.privateKeyBytes || !this.pool) return false;
      const tags = channelId ? [['e', channelId]] : [];
      const event = nostrTools.finalizeEvent(
        { kind: 42, created_at: Math.floor(Date.now() / 1000), tags, content },
        this.privateKeyBytes
      );
      try {
        await this.pool!.publish(this.getPublishRelays(), event);
        return true;
      } catch (publishError: any) {
        if (this.isRelayPolicyError(publishError)) return true;
        return false;
      }
    } catch { return false; }
  }

  async updateProfile(metadata: any): Promise<boolean> {
    try {
      if (!this.privateKeyBytes || !this.pool) return false;
      const event = nostrTools.finalizeEvent(
        { kind: 0, created_at: Math.floor(Date.now() / 1000), tags: [], content: JSON.stringify(metadata) },
        this.privateKeyBytes
      );
      await this.pool!.publish(this.getPublishRelays(), event);
      return true;
    } catch { return false; }
  }

  async signData(data: string, timestamp: number): Promise<string> {
    if (!this.privateKeyBytes || !this.isInitialized) {
      throw new Error('Not initialized');
    }
    const msg = data + timestamp;
    const msgEncoded = new TextEncoder().encode(msg);
    const hashBuffer = await crypto.subtle.digest('SHA-256', msgEncoded);
    const hash = new Uint8Array(hashBuffer);
    const sig = await (secp256k1.schnorr as any).sign(hash, this.privateKeyBytes);
    return Array.from(sig as Uint8Array)
      .map((b: number) => (b < 16 ? '0' : '') + b.toString(16))
      .join('');
  }

  async verifyData(data: string, sig: string, pubkey: string, timestamp: number): Promise<boolean> {
    try {
      const msg = data + timestamp;
      const msgEncoded = new TextEncoder().encode(msg);
      const hashBuffer = await crypto.subtle.digest('SHA-256', msgEncoded);
      const hash = new Uint8Array(hashBuffer);
      const sigBytes = new Uint8Array(sig.match(/.{1,2}/g)!.map(byte => parseInt(byte, 16)));
      const pubkeyBytes = new Uint8Array(pubkey.match(/.{1,2}/g)!.map(byte => parseInt(byte, 16)));
      return await (secp256k1.schnorr as any).verify(sigBytes, hash, pubkeyBytes);
    } catch { return false; }
  }

  private async subscribeToPresenceEvents(): Promise<void> {
    if (!this.pool || this.connectedRelays.size === 0) return;

    // ── FIX #3: store subscription reference ──
    this.presenceSubscription = this.pool.subscribeMany(
      Array.from(this.connectedRelays),
      [{ kinds: [this.PRESENCE_KIND], '#d': ['xitchat-presence'], limit: 10 }],
      {
        onevent: (event: any) => this.handlePresenceEvent(event),
        onclose: (reasons: any) => {
          console.debug('📡 Presence subscription closed:', reasons);
        }
      }
    );
  }

  private async handlePresenceEvent(event: any): Promise<void> {
    if (event.pubkey === this.publicKey) return;
    try {
      const data = JSON.parse(event.content);
      const peer: NostrPeer = {
        id: event.pubkey,
        publicKey: event.pubkey,
        name: data.name,
        lastSeen: new Date(event.created_at * 1000),
        isConnected: true
      };
      this.peers.set(event.pubkey, peer);
      this.emit('peerUpdated', peer);
      this.emit('presenceEvent', { ...data, pubkey: event.pubkey, lastSeen: peer.lastSeen });
    } catch {}
  }

  async publishPresenceEvent(presenceData: NostrPresenceEvent): Promise<boolean> {
    try {
      if (!this.privateKeyBytes || !this.pool) return false;
      const event = nostrTools.finalizeEvent(
        {
          kind: this.PRESENCE_KIND,
          created_at: Math.floor(Date.now() / 1000),
          tags: [['d', 'xitchat-presence']],
          content: JSON.stringify(presenceData)
        },
        this.privateKeyBytes
      );
      await this.pool!.publish(this.getPublishRelays(), event);
      return true;
    } catch { return false; }
  }

  // ── FIX #4: searchUsers uses NIP-50 search where available ──────────────
  async searchUsers(query: string): Promise<NostrPeer[]> {
    if (!this.pool || !this.isConnected()) return [];
    try {
      const events = await this.pool.querySync(this.getQueryRelays(), {
        kinds: [0],
        search: query, // NIP-50 (supported by nos.lol, nostr.band, etc.)
        limit: 50
      });
      return events
        .map((event: any) => {
          try {
            const profile = JSON.parse(event.content);
            const q = query.toLowerCase();
            if (
              profile.name?.toLowerCase().includes(q) ||
              profile.display_name?.toLowerCase().includes(q) ||
              profile.nip05?.toLowerCase().includes(q)
            ) {
              return {
                id: event.pubkey,
                publicKey: event.pubkey,
                name: profile.name || profile.display_name,
                picture: profile.picture,
                about: profile.about,
                nip05: profile.nip05,
                lastSeen: new Date(event.created_at * 1000),
                isConnected: false
              };
            }
          } catch {}
          return null;
        })
        .filter((p: any) => p !== null) as NostrPeer[];
    } catch { return []; }
  }

  getPublicKey(): string | null { return this.publicKey; }
  getPeers(): NostrPeer[] { return Array.from(this.peers.values()); }
  getConnectionInfo() {
    return {
      healthy: this.isConnected(),
      connected: this.connectedRelays.size,
      relayCount: this.connectedRelays.size,
      failed: this.failedRelays.size,
      publicKey: this.publicKey
    };
  }

  async disconnect(): Promise<void> {
    this.closeSubscriptions();
    if (this.pool) this.pool.close(this.defaultRelays);
    this.connectedRelays.clear();
    this.isInitialized = false;
  }

  async retryFailedRelays(): Promise<void> { await this.connectToRelays(); }
  async healthCheck() {
    return { healthy: this.isConnected(), connected: this.connectedRelays.size, failed: this.failedRelays.size };
  }

  subscribe(event: string, callback: (data: any) => void): () => void {
    if (!this.listeners[event]) this.listeners[event] = [];
    this.listeners[event].push(callback);
    return () => { this.listeners[event] = this.listeners[event].filter(l => l !== callback); };
  }

  private emit(event: string, data?: any): void {
    (this.listeners[event] || []).forEach(cb => cb(data));
  }

  // ── Helper: relay policy error detection (DRY) ────────────────────────────
  private isRelayPolicyError(error: any): boolean {
    const msg = error?.message || String(error);
    return msg.includes('spam') || msg.includes('restricted') ||
      msg.includes('blocked') || msg.includes('Policy violated') ||
      msg.includes('web of trust') || msg.includes('replaced') ||
      msg.includes('newer event');
  }
}

export const nostrService = new NostrService();
