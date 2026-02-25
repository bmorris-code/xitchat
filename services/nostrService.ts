// Nostr Protocol Service for XitChat
// Implements decentralized global communication using Nostr relays
// Supports presence events for global radar discovery

import * as nostrTools from 'nostr-tools';
import * as secp256k1 from '@noble/secp256k1';
import { networkStateManager, NetworkService } from './networkStateManager';

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

export interface NostrChannel {
  id: string;
  name: string;
  about: string;
  picture?: string;
  creators: string[];
  participants: string[];
  isPublic: boolean;
  created_at: number;
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
  private relays: Set<string> = new Set();
  private connectedRelays: Set<string> = new Set();
  private failedRelays: Set<string> = new Set();
  private peers: Map<string, NostrPeer> = new Map();
  private listeners: { [key: string]: ((data: any) => void)[] } = {};
  private subscriptionRetryCount = new Map<string, number>();
  private lastSubscriptionTime = new Map<string, number>();
  private lastPublishTime = new Map<string, number>();
  private readonly RATE_LIMIT_DELAY = 60000; // 60 seconds between subscriptions (increased from 30)
  private readonly PUBLISH_RATE_LIMIT = 30000; // 30 seconds between publishes (increased from 15)
  private isInitialized = false;
  private isInitializing = false;

  // Exponential backoff properties
  private retryDelay = 1000;
  private maxRetries = 5;
  private lastErrorTime = new Map<string, number>();

  private serviceInfo: NetworkService = {
    name: 'nostr',
    isConnected: false,
    isHealthy: false,
    lastCheck: 0,
    reconnectAttempts: 0,
    maxReconnectAttempts: 5,
    reconnectDelay: 3000
  };

  // Default public Nostr relays - using only most reliable ones
  private readonly defaultRelays = [
    'wss://relay.damus.io',
    'wss://nos.lol',
  'wss://relay.snort.social'
  ];

  private getQueryRelays(): string[] {
    const connected = Array.from(this.connectedRelays);
    return connected.length > 0 ? connected : this.defaultRelays;
  }

  private getPublishRelays(): string[] {
    return Array.from(this.connectedRelays);
  }

  private async publishToRelay(relayUrl: string, event: any): Promise<boolean> {
    try {
      await Promise.race([
        this.pool!.publish([relayUrl], event),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error(`Publish timeout to ${relayUrl}`)), 12000)
        )
      ]);
      return true;
    } catch (error) {
      this.connectedRelays.delete(relayUrl);
      this.failedRelays.add(relayUrl);
      return false;
    }
  }

  // Presence event constants
  private readonly PRESENCE_KIND = 30315; // Custom kind for presence events
  private readonly PRESENCE_TTL = 300000; // 2 minutes TTL for presence events
  private presenceSubscription: any = null;
  private lastPresencePublish = 0;
  private readonly PRESENCE_PUBLISH_INTERVAL = 45000; // Publish presence every 120 seconds (reduced load)
  private isRateLimited = false;
  private rateLimitBackoff = 0;

  // Show user-friendly notification
  private showUserNotification(message: string): void {
    // Emit notification event for UI to handle
    this.emit('notification', {
      type: 'info',
      message: message,
      timestamp: new Date()
    });

    // Also log to console for debugging
    console.log(`🔔 User Notification: ${message}`);
  }

  // Setup global error handling to suppress spam
  private setupGlobalErrorHandling(): void {
    if (typeof window === 'undefined') return;

    // Catch all WebSocket/network errors to reduce console spam
    const originalConsoleError = console.error;
    console.error = (...args: any[]) => {
      const message = args.join(' ');

      if (message.includes('rate-limited') || message.includes('slow down matey')) {
        console.debug('⚠️ Nostr network issue (handled):', message);
        // Don't spam console with rate limit errors
        return;
      }
      if (message.includes('pow:') && message.includes('bits needed')) {
        console.debug('⚠️ Nostr PoW relay requirement (handled):', message);
        return;
      }

      if (message.includes('WebSocket') && (
        message.includes('failed') || 
        message.includes('ERR_NAME_NOT_RESOLVED') ||
        message.includes('ERR_CONNECTION_TIMED_OUT') ||
        message.includes('opening handshake timed out') ||
        message.includes('net::')
      )) {
        console.debug('⚠️ WebSocket issue (handled):', message);
        return;
      }

      if (message.includes('CLOSING') || message.includes('CLOSED')) {
        console.debug('⚠️ WebSocket state issue (handled):', message);
        return;
      }

      // Handle Ably connection errors
      if (message.includes('ably-realtime') || message.includes('Ably')) {
        console.debug('⚠️ Ably connection issue (handled):', message);
        return;
      }

      originalConsoleError.apply(console, args);
    };
  }

  // Exponential backoff for rate limiting
  private async sendWithBackoff(operation: () => Promise<any>, operationType: string, retries = 0): Promise<any> {
    try {
      const result = await operation();
      this.retryDelay = 1000; // Reset on success
      return result;
    } catch (error: any) {
      if (error.message?.includes('rate-limited') && retries < this.maxRetries) {
        const delay = this.retryDelay * Math.pow(2, retries);
        console.log(`⏳ Rate limited, retrying ${operationType} in ${delay}ms (attempt ${retries + 1}/${this.maxRetries})`);

        await new Promise(resolve => setTimeout(resolve, delay));
        return this.sendWithBackoff(operation, operationType, retries + 1);
      }
      throw error;
    }
  }

  // Improved decryption with timeout and validation
  private async decryptMessageWithTimeout(senderPubkey: string, encryptedContent: string): Promise<string> {
    if (!this.privateKey) {
      throw new Error('Private key not initialized');
    }

    if (!encryptedContent || typeof encryptedContent !== 'string') {
      throw new Error('Invalid encrypted data format');
    }

    try {
      // Attempt decryption with timeout
      const result = await Promise.race([
        nostrTools.nip04.decrypt(this.privateKey, senderPubkey, encryptedContent),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('Decryption timeout')), 5000)
        )
      ]);

      return result;
    } catch (error: any) {
      // Handle all crypto-related errors comprehensively
      const errorMsg = error?.message || error?.toString() || 'Unknown decryption error';

      // Check for various crypto error patterns
      if (
        error?.name === 'OperationError' ||
        error?.name === 'DOMException' ||
        errorMsg.includes('OperationError') ||
        errorMsg.includes('decryption failed') ||
        errorMsg.includes('bad mac') ||
        errorMsg.includes('invalid') ||
        errorMsg.includes('crypto') ||
        errorMsg.includes('key') ||
        errorMsg.includes('algorithm')
      ) {
        // Create a standardized error for all crypto failures
        const cryptoError = new Error('Message decryption failed');
        cryptoError.name = 'OperationError';
        throw cryptoError;
      }

      // Re-throw timeout and other errors as-is
      throw error;
    }
  }

  // Peer discovery with retry mechanism
  private async findPeerWithRetry(peerId: string, maxAttempts = 3): Promise<NostrPeer | null> {
    for (let i = 0; i < maxAttempts; i++) {
      const peer = this.peers.get(peerId);

      if (peer) {
        return peer;
      }

      // Wait before retry with exponential backoff
      const delay = 2000 * Math.pow(2, i);
      console.log(`🔍 Peer ${peerId.substring(0, 8)}... not found, retrying in ${delay}ms (attempt ${i + 1}/${maxAttempts})`);
      await new Promise(resolve => setTimeout(resolve, delay));

      // Try refreshing peer list
      await this.refreshPeerList();
    }

    return this.peers.get(peerId) || null;
  }

  // Refresh peer list
  private async refreshPeerList(): Promise<void> {
    try {
      // Query recent peers from relays
      const activeRelays = Array.from(this.connectedRelays);
      if (activeRelays.length === 0) return;

      const recentEvents = await this.pool!.querySync(activeRelays, {
        kinds: [0], // Metadata events
        limit: 10
      });

      // Update peer list with fresh data
      recentEvents.forEach(event => {
        if (!this.peers.has(event.pubkey)) {
          try {
            const metadata = JSON.parse(event.content);
            const peer: NostrPeer = {
              id: event.pubkey,
              publicKey: event.pubkey,
              name: metadata.name,
              picture: metadata.picture,
              about: metadata.about,
              nip05: metadata.nip05,
              lastSeen: new Date(event.created_at * 1000),
              isConnected: true
            };
            this.peers.set(event.pubkey, peer);
          } catch (error) {
            // Skip invalid metadata
          }
        }
      });
    } catch (error) {
      console.warn('⚠️ Failed to refresh peer list:', error);
    }
  }

  async initialize(privateKey?: string): Promise<boolean> {
    if (this.isInitialized) {
      return true;
    }
    if (this.isInitializing) {
      for (let i = 0; i < 50; i++) {
        await new Promise(resolve => setTimeout(resolve, 100));
        if (this.isInitialized) return true;
      }
      return false;
    }
    this.isInitializing = true;
    try {
      console.log('🔑 Initializing Nostr service...');

      // Setup global error handling first
      this.setupGlobalErrorHandling();

      // Add comprehensive global error handling
      if (typeof window !== 'undefined') {
        window.addEventListener('unhandledrejection', (event) => {
          const reason = event.reason;

          if (reason?.message?.includes('rate-limited') || reason?.message?.includes('slow down')) {
            console.warn('⚠️ Nostr network issue (handled):', reason.message);
            this.showUserNotification('Network busy, retrying automatically...');
            event.preventDefault();
          } else if (reason?.message?.includes('pow:') || reason?.message?.includes('bits needed')) {
            console.warn('⚠️ Relay requires PoW (handled):', reason.message || reason);
            this.showUserNotification('Some relays require PoW, retrying with other relays...');
            event.preventDefault();
          } else if (reason?.message?.includes('connection timed out') || reason?.message?.includes('timeout') || reason?.message?.includes('publish timed out')) {
            console.warn('⚠️ Nostr connection timeout (handled):', reason.message);
            this.showUserNotification('Connection slow, using offline mode...');
            event.preventDefault();
          } else if (reason?.message?.includes('Decryption failed') || reason?.message?.includes('decryption') || reason?.message?.includes('Message decryption failed') || (reason instanceof Error && reason.name === 'OperationError')) {
            console.warn('⚠️ Message decryption failed (handled):', reason.message || reason);
            this.showUserNotification('Unable to decrypt some messages');
            event.preventDefault();
          } else if (reason?.name === 'InvalidStateError' || reason?.message?.includes('createAnswer')) {
            console.debug('⚠️ WebRTC state error (handled):', reason.message);
            event.preventDefault();
          } else if (reason?.message && /Peer .* not found/.test(reason.message)) {
            console.warn('⚠️ Peer not found (handled):', reason.message);
            this.showUserNotification('Searching for peer...');
            event.preventDefault();
          } else if (reason?.message?.includes('not found') || reason?.message?.includes('not reachable')) {
            console.warn('⚠️ Peer connection issue (handled):', reason.message);
            this.showUserNotification('Peer connection issue, retrying...');
            event.preventDefault();
          }
        });
      }

      // Initialize keys
      if (privateKey) {
        this.privateKey = privateKey;
      } else {
        // Security hardening: do not persist private keys in localStorage.
        // Generate an in-memory session key unless an explicit key is provided.
        const secretKey = new Uint8Array(32);
        crypto.getRandomValues(secretKey);
        this.privateKey = Array.from(secretKey).map(b => b.toString(16).padStart(2, '0')).join('');
        console.log('🔑 Generated in-memory Nostr private key for this session');
      }

      // Convert hex private key to public key using secp256k1
      // Robust hex to bytes conversion
      const cleanHex = this.privateKey.replace(/^0x/i, '');
      if (cleanHex.length !== 64) {
        throw new Error(`Invalid private key length: ${cleanHex.length} chars (expected 64)`);
      }

      const privateKeyBytes = new Uint8Array(32);
      for (let i = 0; i < 32; i++) {
        privateKeyBytes[i] = parseInt(cleanHex.substr(i * 2, 2), 16);
      }

      // Generate real public key using secp256k1
      try {
        const publicKeyBytes = secp256k1.getPublicKey(privateKeyBytes);
        // Nostr uses 32-byte x-only public keys (schnorr)
        // If noble-secp256k1 returns 33-byte compressed key, we take last 32
        const finalPubKey = publicKeyBytes.length === 33 ? publicKeyBytes.slice(1) : publicKeyBytes;
        this.publicKey = Array.from(finalPubKey).map(b => b.toString(16).padStart(2, '0')).join('');
        console.log('✅ Generated real secp256k1 public key');
      } catch (error) {
        console.error('❌ Failed to generate public key with secp256k1:', error);
        throw new Error('Failed to generate valid Nostr public key');
      }
      console.log(`🔑 Nostr public key: ${this.publicKey.substring(0, 16)}...`);

      // Initialize relay pool
      this.pool = new nostrTools.SimplePool();

      // Connect to relays
      await this.connectToRelays();

      // Load user profile
      await this.loadUserProfile();

      // Subscribe to relevant events
      await this.subscribeToEvents();

      // Subscribe to presence events for global radar
      await this.subscribeToPresenceEvents();

      // Register with network state manager
      this.serviceInfo.healthCheck = () => this.performHealthCheckInternal();
      this.serviceInfo.reconnect = () => this.initialize(privateKey);
      networkStateManager.registerService(this.serviceInfo);

      this.isInitialized = true;
      this.serviceInfo.isConnected = true;
      this.serviceInfo.isHealthy = true;
      networkStateManager.updateServiceStatus('nostr', true, true);

      console.log('✅ Nostr service initialized successfully');
      this.emit('initialized', { publicKey: this.publicKey });
      this.isInitializing = false;
      return true;
    } catch (error) {
      console.warn('⚠️ Nostr service initialization skipped (Offline Mode):', error);
      this.isInitializing = false;
      return false;
    }
  }

  private async connectToRelays(): Promise<void> {
    console.log('🌐 Connecting to Nostr relays...');

    // Process connections sequentially to avoid rate limiting
    for (const relayUrl of this.defaultRelays) {
      try {
        console.log(`📡 Connecting to ${relayUrl}...`);

        // Add a 15-second timeout with better error handling
        const relay = await Promise.race([
          this.pool!.ensureRelay(relayUrl),
          new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error(`Connection timeout to ${relayUrl}`)), 15000)
          )
        ]);

        this.relays.add(relayUrl);
        this.connectedRelays.add(relayUrl);
        console.log(`✅ Connected to ${relayUrl}`);

        // Add delay between connections to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 2000));

      } catch (error) {
        const lastError = this.lastErrorTime.get(relayUrl) || 0;
        const now = Date.now();
        if (now - lastError > 60000) {
          console.warn(`⚠️ Failed to connect to ${relayUrl}:`, error);
          this.lastErrorTime.set(relayUrl, now);
        } else {
          console.debug(`Relay connect retry failed for ${relayUrl}`);
        }
        this.failedRelays.add(relayUrl);

        // Continue with next relay instead of failing completely
        continue;
      }
    }

    console.log(`🌐 Connected to ${this.connectedRelays.size}/${this.defaultRelays.length} relays`);

    // If no relays connected, don't fail completely - work in offline mode
    if (this.connectedRelays.size === 0) {
      console.warn('⚠️ No relays connected, working in offline mode');
    }
  }

  private async loadUserProfile(): Promise<void> {
    try {
      // Fetch user metadata
      const metadataEvents = await this.pool!.querySync(this.getQueryRelays(), {
        kinds: [0], // Metadata event
        authors: [this.publicKey!],
        limit: 1
      });

      if (metadataEvents.length > 0) {
        const metadata = JSON.parse(metadataEvents[0].content);
        console.log('👤 Loaded user profile:', metadata);
        this.emit('profileLoaded', metadata);
      }
    } catch (error) {
      console.warn('⚠️ Failed to load user profile:', error);
    }
  }

  // In nostrService.ts

  private async subscribeToEvents(): Promise<void> {
    const activeRelays = Array.from(this.connectedRelays);
    if (activeRelays.length === 0) return;

    // Check rate limiting
    const now = Date.now();
    const lastSubTime = this.lastSubscriptionTime.get('main') || 0;
    if (now - lastSubTime < this.RATE_LIMIT_DELAY) {
      console.log('⏳ Rate limiting subscription, waiting...');
      return;
    }
    this.lastSubscriptionTime.set('main', now);

    try {
      const allPeers = Array.from(this.peers.keys());
      const recentPeers = allPeers.slice(0, 3); // Reduced to prevent filter size errors

      // Subscribe to direct messages with error handling
      try {
        this.pool!.subscribeMany(activeRelays, {
          kinds: [4],
          '#p': [this.publicKey!],
          limit: 3 // Further reduced from 5
        }, {
          onevent: async (event) => {
            await this.handleDirectMessage(event);
          },
          oneose: () => {
            console.log('✅ Direct messages subscription ready');
          },
          onclose: (reason: string) => {
            if (reason.includes('rate-limited')) {
              console.debug('⚠️ Rate limited, backing off...');
              setTimeout(() => this.subscribeToEvents(), 30000);
            }
          }
        });
      } catch (error: any) {
        if (error.message.includes('rate-limited')) {
          console.debug('⚠️ Rate limited on direct messages, backing off...');
          setTimeout(() => this.subscribeToEvents(), 30000);
          return;
        }
      }

      // Subscribe to channel messages with error handling
      try {
        this.pool!.subscribeMany(activeRelays, {
          kinds: [42],
          limit: 3 // Further reduced from 5
        }, {
          onevent: async (event) => {
            this.handleChannelMessage(event);
          },
          oneose: () => {
            console.log('✅ Channel messages subscription ready');
          },
          onclose: (reason: string) => {
            if (reason.includes('rate-limited')) {
              console.debug('⚠️ Rate limited, backing off...');
              setTimeout(() => this.subscribeToEvents(), 30000);
            }
          }
        });
      } catch (error: any) {
        if (error.message.includes('rate-limited')) {
          console.debug('⚠️ Rate limited on channel messages, backing off...');
          setTimeout(() => this.subscribeToEvents(), 30000);
          return;
        }
      }

      // Subscribe to metadata updates for recent peers
      if (recentPeers.length > 0) {
        this.pool!.subscribeMany(activeRelays, {
          kinds: [0],
          authors: recentPeers
        }, {
          onevent: async (event) => {
            this.handleMetadataUpdate(event);
          }
        });
      }

      console.log(`👂 Subscribed to Nostr events (Tracking ${recentPeers.length} peers)`);
    } catch (error) {
      console.warn('⚠️ Failed to subscribe to events:', error);
    }
  }

  private async handleDirectMessage(event: any): Promise<void> {
    try {
      // Validate event structure first
      if (!event || !event.content || !event.pubkey) {
        console.warn('⚠️ Invalid direct message event structure');
        return;
      }

      // Decrypt direct message with improved error handling and timeout
      let decryptedContent: string;
      try {
        decryptedContent = await this.decryptMessageWithTimeout(event.pubkey, event.content);
      } catch (decryptError: any) {
        // Handle OperationError specifically (browser crypto API errors)
        if (decryptError.name === 'OperationError') {
          console.warn('⚠️ Browser crypto operation failed - incompatible keys:', event.pubkey.substring(0, 8));
          this.showUserNotification('Unable to decrypt message - incompatible encryption');
          return;
        }

        const errorMsg = decryptError.message || 'Unknown decryption error';

        if (errorMsg.includes('timeout')) {
          console.warn('⚠️ Decryption timeout - message may be corrupted');
        } else if (errorMsg.includes('Private key not initialized')) {
          console.warn('⚠️ Cannot decrypt - keys not ready');
        } else if (errorMsg.includes('bad mac') || errorMsg.includes('invalid')) {
          console.warn('⚠️ Invalid message format or wrong keys');
        } else {
          console.warn('⚠️ Decryption failed:', errorMsg);
        }

        // Don't crash the app, just skip this message
        return;
      }

      // Validate decrypted content
      if (!decryptedContent || typeof decryptedContent !== 'string') {
        console.warn('⚠️ Invalid decrypted content');
        return;
      }

      const message = {
        id: event.id,
        from: event.pubkey,
        to: this.publicKey,
        content: decryptedContent,
        timestamp: new Date(event.created_at * 1000),
        type: 'direct'
      };

      console.log(`📨 Received direct message from ${event.pubkey.substring(0, 8)}...`);
      this.emit('messageReceived', message);
    } catch (error: any) {
      // Catch any remaining errors
      console.error('❌ Unexpected error handling direct message:', error?.message || error);
      // Don't re-throw - prevent unhandled rejection
    }
  }

  private handleChannelMessage(event: any): void {
    try {
      const message = {
        id: event.id,
        channelId: event.tags.find((tag: string[]) => tag[0] === 'e')?.[1],
        from: event.pubkey,
        content: event.content,
        timestamp: new Date(event.created_at * 1000),
        type: 'channel'
      };

      console.log(`📢 Received channel message in ${message.channelId}`);
      this.emit('channelMessageReceived', message);
    } catch (error) {
      console.error('❌ Failed to handle channel message:', error);
    }
  }

  private handleMetadataUpdate(event: any): void {
    try {
      const metadata = JSON.parse(event.content);
      const peer: NostrPeer = {
        id: event.pubkey,
        publicKey: event.pubkey,
        name: metadata.name,
        picture: metadata.picture,
        about: metadata.about,
        nip05: metadata.nip05,
        lastSeen: new Date(event.created_at * 1000),
        isConnected: true
      };

      this.peers.set(event.pubkey, peer);
      console.log(`👤 Updated peer metadata: ${peer.name || event.pubkey.substring(0, 8) + '...'}`);
      this.emit('peerUpdated', peer);
    } catch (error) {
      console.error('❌ Failed to handle metadata update:', error);
    }
  }

  async sendDirectMessage(recipientPublicKey: string, content: string): Promise<boolean> {
    try {
      if (!this.privateKey || !this.publicKey) {
        throw new Error('Nostr service not initialized');
      }

      // Validate recipient public key format FIRST
      if (!recipientPublicKey || typeof recipientPublicKey !== 'string' || recipientPublicKey.length !== 64) {
        console.error('❌ Invalid recipient public key format');
        this.showUserNotification('Invalid peer address');
        return false;
      }

      // Find peer with retry mechanism
      const peer = await this.findPeerWithRetry(recipientPublicKey);
      if (!peer) {
        console.debug(`Peer ${recipientPublicKey.substring(0, 8)}... not in local cache; sending anyway`);
      }

      if (this.connectedRelays.size === 0) {
        console.warn('⚠️ No relays connected, attempting to reconnect...');
        await this.connectToRelays();
      }

      // Encrypt message
      const encryptedContent = await nostrTools.nip04.encrypt(this.privateKey, recipientPublicKey, content);

      // Validate encrypted content
      if (!encryptedContent || encryptedContent.length === 0) {
        throw new Error('Failed to encrypt message');
      }

      // Create event with validated data
      const privateKeyBytes = new Uint8Array(this.privateKey.match(/.{1,2}/g)!.map(byte => parseInt(byte, 16)));

      // Ensure tags are properly formatted
      const tags = [['p', recipientPublicKey]];

      const event = nostrTools.finalizeEvent({
        kind: 4, // Direct message
        created_at: Math.floor(Date.now() / 1000),
        tags: tags,
        content: encryptedContent
      }, privateKeyBytes);

      // Validate event before publishing
      if (!event || !event.id || !event.sig) {
        throw new Error('Failed to create valid Nostr event');
      }

      // Publish to connected relays with exponential backoff
      const publishOperation = async () => {
        const successfulRelays: string[] = [];
        const promises = Array.from(this.connectedRelays).map(async (relayUrl) => {
          try {
            await this.pool!.publish([relayUrl], event);
            successfulRelays.push(relayUrl);
            console.log(`✅ Published to ${relayUrl}`);
          } catch (error) {
            console.error(`❌ Failed to publish to ${relayUrl}:`, error);
            this.failedRelays.add(relayUrl);
          }
        });

        await Promise.allSettled(promises);

        if (successfulRelays.length === 0) {
          throw new Error('Failed to publish to any relay');
        }

        return successfulRelays;
      };

      const successfulRelays = await this.sendWithBackoff(publishOperation, 'message send');

      console.log(`📤 Sent direct message to ${recipientPublicKey.substring(0, 8)}... via ${successfulRelays.length} relays`);
      this.emit('messageSent', {
        id: event.id,
        to: recipientPublicKey,
        content: content,
        timestamp: new Date()
      });
      return true;
    } catch (error) {
      console.error('❌ Failed to send direct message:', error);
      return false;
    }
  }

  async publishChannelMessage(channelId: string, content: string): Promise<boolean> {
    try {
      if (!this.privateKey || !this.publicKey) {
        throw new Error('Nostr service not initialized');
      }

      const privateKeyBytes = new Uint8Array(this.privateKey.match(/.{1,2}/g)!.map(byte => parseInt(byte, 16)));

      // Validate content and channel ID
      if (!content || content.length === 0) {
        throw new Error('Channel message content cannot be empty');
      }

      // Allow empty channel ID for broadcast scenarios
      if (channelId && typeof channelId !== 'string') {
        console.warn('Invalid channel ID format:', channelId, typeof channelId);
        throw new Error('Invalid channel ID format');
      }

      // Ensure tags are properly formatted (only add 'e' tag if channelId exists)
      const tags = channelId ? [['e', channelId]] : [];

      const event = nostrTools.finalizeEvent({
        kind: 42, // Channel message
        created_at: Math.floor(Date.now() / 1000),
        tags: tags,
        content: content
      }, privateKeyBytes);

      // Validate event before publishing
      if (!event || !event.id || !event.sig) {
        throw new Error('Failed to create valid Nostr event');
      }

      let targetRelays = this.getPublishRelays();
      if (targetRelays.length === 0) {
        await this.retryFailedRelays();
        targetRelays = this.getPublishRelays();
      }
      if (targetRelays.length === 0) {
        throw new Error('No connected relays available for channel publish');
      }
      const results = await Promise.allSettled(
        targetRelays.map(relayUrl => this.publishToRelay(relayUrl, event))
      );
      const successful = results.filter(r => r.status === 'fulfilled' && r.value).length;
      if (successful === 0) {
        throw new Error('Failed to publish channel message to any relay');
      }
      console.log(`📢 Published message to channel ${channelId || 'broadcast'} via ${successful}/${targetRelays.length} relays`);

      this.emit('channelMessageSent', {
        id: event.id,
        channelId: channelId,
        content: content,
        timestamp: new Date()
      });

      return true;
    } catch (error) {
      console.error('❌ Failed to publish channel message:', error);
      console.error('Debug info - channelId:', channelId, 'type:', typeof channelId, 'content:', content);
      return false;
    }
  }

  async updateProfile(metadata: { name?: string; about?: string; picture?: string; nip05?: string; banner?: string;[key: string]: any }): Promise<boolean> {
    try {
      if (!this.privateKey || !this.publicKey) {
        throw new Error('Nostr service not initialized');
      }

      const privateKeyBytes = new Uint8Array(this.privateKey.match(/.{1,2}/g)!.map(byte => parseInt(byte, 16)));

      const event = nostrTools.finalizeEvent({
        kind: 0, // Metadata event
        created_at: Math.floor(Date.now() / 1000),
        tags: [],
        content: JSON.stringify(metadata)
      }, privateKeyBytes);

      let targetRelays = this.getPublishRelays();
      if (targetRelays.length === 0) {
        await this.retryFailedRelays();
        targetRelays = this.getPublishRelays();
      }
      if (targetRelays.length === 0) {
        throw new Error('No connected relays available for profile update');
      }
      const results = await Promise.allSettled(
        targetRelays.map(relayUrl => this.publishToRelay(relayUrl, event))
      );
      const successful = results.filter(r => r.status === 'fulfilled' && r.value).length;
      if (successful === 0) {
        throw new Error('Failed to publish profile update to any relay');
      }
      console.log(`👤 Profile updated on Nostr via ${successful}/${targetRelays.length} relays`);

      this.emit('profileUpdated', metadata);
      return true;
    } catch (error) {
      console.error('❌ Failed to update profile on Nostr:', error);
      return false;
    }
  }

  async broadcastMessage(content: string): Promise<boolean> {
    try {
      if (!this.privateKey || !this.publicKey) {
        throw new Error('Nostr service not initialized');
      }

      // Rate limiting check
      const now = Date.now();
      const lastPublishTime = this.lastPublishTime.get('broadcast') || 0;
      if (now - lastPublishTime < this.PUBLISH_RATE_LIMIT) {
        console.log('⏳ Rate limiting broadcast, waiting...');
        return false;
      }
      this.lastPublishTime.set('broadcast', now);

      const privateKeyBytes = new Uint8Array(this.privateKey.match(/.{1,2}/g)!.map(byte => parseInt(byte, 16)));

      // Validate content
      if (!content || content.length === 0) {
        throw new Error('Broadcast content cannot be empty');
      }

      const event = nostrTools.finalizeEvent({
        kind: 1, // Text note (broadcast)
        created_at: Math.floor(Date.now() / 1000),
        tags: [], // No tags needed for broadcast
        content: content
      }, privateKeyBytes);

      // Validate event before publishing
      if (!event || !event.id || !event.sig) {
        throw new Error('Failed to create valid Nostr event');
      }

      // Publish to relays with timeout and error handling
      let targetRelays = this.getPublishRelays();
      if (targetRelays.length === 0) {
        await this.retryFailedRelays();
        targetRelays = this.getPublishRelays();
      }
      if (targetRelays.length === 0) {
        console.debug('No connected relays available for broadcast');
        return false;
      }
      const publishPromises = targetRelays.map(async (relayUrl) => {
        try {
          // Add timeout to prevent hanging
          const result = await Promise.race([
            this.publishToRelay(relayUrl, event),
            new Promise<never>((_, reject) =>
              setTimeout(() => reject(new Error('Publish timeout')), 15000)
            )
          ]);
          return { relay: relayUrl, success: !!result, result };
        } catch (error: any) {
          if (error.message && (error.message.includes('rate-limited') || error.message.includes('slow down'))) {
            console.debug(`⚠️ Rate limited by ${relayUrl}, backing off...`);
            return { relay: relayUrl, success: false, error: 'rate-limited' };
          }
          return { relay: relayUrl, success: false, error: error.message || 'Unknown error' };
        }
      });

      const results = await Promise.allSettled(publishPromises);
      const successful = results.filter(r => r.status === 'fulfilled' && r.value.success).length;

      if (successful > 0) {
        console.log(`📢 Broadcasted message to ${successful}/${targetRelays.length} relays`);
        this.emit('messageBroadcasted', {
          id: event.id,
          content: content,
          timestamp: new Date()
        });
        return true;
      } else {
        console.debug('⚠️ All relays rejected broadcast (rate limited or failed)');
        return false;
      }
    } catch (error) {
      console.error('❌ Failed to broadcast message:', error);
      return false;
    }
  }

  async publishNote(content: string): Promise<boolean> {
    return this.broadcastMessage(content);
  }

  private async subscribeToPresenceEvents(): Promise<void> {
    if (!this.pool || this.connectedRelays.size === 0) {
      console.warn('⚠️ Nostr pool not initialized or no connected relays, skipping presence subscription');
      return;
    }

    const activeRelays = Array.from(this.connectedRelays);

    try {
      console.log('🗼 Subscribing to Nostr presence events for global radar...');

      // Create a subscription using `subscribeMany` (SimplePool method)
      this.presenceSubscription = this.pool!.subscribeMany(activeRelays, {
        kinds: [this.PRESENCE_KIND],
        '#d': ['xitchat-presence'], // Filter only our D-tag
        limit: 10
      }, {
        onevent: async (event: any) => {
          await this.handlePresenceEvent(event);
        },
        oneose: () => {
          console.log('✅ Presence events subscription ready');
        },
        onclose: (reason: string) => {
          console.debug('⚠️ Presence subscription closed:', reason);
          // Auto-resubscribe after a short delay
          setTimeout(() => this.subscribeToPresenceEvents(), 30000);
        }
      });

      console.log('🗼 Presence subscription created successfully');
    } catch (error) {
      console.error('❌ Failed to subscribe to presence events:', error);
    }
  }

  private async handlePresenceEvent(event: any): Promise<void> {
    try {
      // Skip own presence events
      if (event.pubkey === this.publicKey) return;

      // Validate content before parsing - must be JSON for presence events
      if (!event.content || typeof event.content !== 'string') {
        return; // Skip invalid content
      }

      // Check if content looks like JSON (starts with {)
      if (!event.content.trim().startsWith('{')) {
        return; // Skip non-JSON content (likely regular messages)
      }

      // Parse presence data with error handling
      let presenceData: NostrPresenceEvent;
      try {
        presenceData = JSON.parse(event.content);
      } catch (parseError) {
        console.debug('⚠️ Received non-JSON content in presence subscription, skipping:', event.content.substring(0, 50));
        return; // Skip if not valid JSON
      }

      // Validate presence data structure
      if (!presenceData || typeof presenceData !== 'object') {
        return; // Skip invalid object
      }

      // Validate required fields for presence events
      if (!presenceData.pubkey || !presenceData.device || !presenceData.role || !presenceData.caps) {
        console.debug('⚠️ Invalid presence event structure, missing required fields');
        return; // Skip malformed presence events
      }

      // TTL check - ignore expired events.
      // Presence TTL is stored in seconds by presenceBeacon, convert to ms here.
      const now = Date.now();
      const ttlMs = presenceData.ttl > 1000 ? presenceData.ttl : presenceData.ttl * 1000;
      if (now - presenceData.timestamp > ttlMs) {
        return; // Expired presence event
      }

      console.log(`🗼 Received presence from ${presenceData.pubkey.substring(0, 8)}...`);

      // Emit presence event for radar integration
      this.emit('presenceEvent', {
        pubkey: presenceData.pubkey,
        device: presenceData.device,
        role: presenceData.role,
        caps: presenceData.caps,
        rooms: presenceData.rooms,
        ttl: presenceData.ttl,
        timestamp: presenceData.timestamp,
        geohash: presenceData.geohash,
        signalStrength: presenceData.signalStrength,
        lastSeen: new Date(event.created_at * 1000)
      });
    } catch (error) {
      console.error('❌ Failed to handle presence event:', error);
    }
  }

  async publishPresenceEvent(presenceData: NostrPresenceEvent): Promise<boolean> {
    try {
      if (!this.privateKey || !this.publicKey) {
        throw new Error('Nostr service not initialized');
      }

      // Check if we're currently rate limited
      if (this.isRateLimited) {
        console.debug('⏳ Currently rate limited, skipping presence publish');
        return false;
      }

      // Rate limiting check
      const now = Date.now();
      if (now - this.lastPresencePublish < this.PRESENCE_PUBLISH_INTERVAL) {
        console.debug('⏳ Rate limiting presence publish');
        return false;
      }
      this.lastPresencePublish = now;

      const privateKeyBytes = new Uint8Array(this.privateKey.match(/.{1,2}/g)!.map(byte => parseInt(byte, 16)));

      // Create presence event
      const event = nostrTools.finalizeEvent({
        kind: this.PRESENCE_KIND,
        created_at: Math.floor(Date.now() / 1000),
        tags: [['d', 'xitchat-presence']], // D-tag for identification
        content: JSON.stringify(presenceData)
      }, privateKeyBytes);

      // Validate event
      if (!event || !event.id || !event.sig) {
        throw new Error('Failed to create valid presence event');
      }

      // Publish to connected relays with rate limit handling
      const successfulRelays: string[] = [];
      const promises = Array.from(this.connectedRelays).map(async (relayUrl) => {
        try {
          await this.pool!.publish([relayUrl], event);
          successfulRelays.push(relayUrl);
        } catch (error: any) {
          if (error.message && error.message.includes('rate-limited')) {
            console.debug(`⚠️ Rate limited by ${relayUrl}, enabling backoff`);
            this.handleRateLimit();
          } else {
            console.debug(`Failed to publish presence to ${relayUrl}:`, error);
          }
        }
      });

      await Promise.allSettled(promises);

      if (successfulRelays.length > 0) {
        console.log(`🗼 Published presence to ${successfulRelays.length} relays`);
        return true;
      }

      return false;
    } catch (error) {
      console.error('❌ Failed to publish presence event:', error);
      return false;
    }
  }

  private handleRateLimit(): void {
    this.isRateLimited = true;
    this.rateLimitBackoff = Math.min(this.rateLimitBackoff + 30000, 300000); // Max 5 minutes backoff

    console.debug(`⏳ Rate limited, backing off for ${this.rateLimitBackoff / 1000}s`);

    setTimeout(() => {
      this.isRateLimited = false;
      this.rateLimitBackoff = 0;
      console.debug('✅ Rate limit backoff ended, resuming normal operations');
    }, this.rateLimitBackoff);
  }

  async searchUsers(query: string): Promise<NostrPeer[]> {
    try {
      // Search for users by name or about field
      const events = await this.pool!.querySync(this.getQueryRelays(), {
        kinds: [0], // Metadata
        search: query,
        limit: 3 // Reduced from 5
      });

      const peers: NostrPeer[] = [];
      for (const event of events) {
        try {
          const metadata = JSON.parse(event.content);
          const peer: NostrPeer = {
            id: event.pubkey,
            publicKey: event.pubkey,
            name: metadata.name,
            picture: metadata.picture,
            about: metadata.about,
            nip05: metadata.nip05,
            lastSeen: new Date(event.created_at * 1000),
            isConnected: true
          };
          peers.push(peer);
        } catch (error) {
          console.warn('Failed to parse metadata for user:', event.pubkey.substring(0, 8) + '...');
        }
      }

      console.log(`🔍 Found ${peers.length} users matching "${query}"`);
      return peers;
    } catch (error) {
      console.error('❌ Failed to search users:', error);
      return [];
    }
  }

  // GETTERS
  getPublicKey(): string | null {
    return this.publicKey;
  }

  getPeers(): NostrPeer[] {
    return Array.from(this.peers.values());
  }

  isConnected(): boolean {
    return this.isInitialized && this.connectedRelays.size > 0;
  }

  getConnectionInfo(): {
    isConnected: boolean;
    relayCount: number;
    publicKey: string | null;
  } {
    return {
      isConnected: this.isConnected(),
      relayCount: this.connectedRelays.size,
      publicKey: this.publicKey
    };
  }

  // EVENT LISTENERS
  private emit(event: string, data?: any): void {
    const listeners = this.listeners[event] || [];
    listeners.forEach(callback => {
      try {
        callback(data);
      } catch (error) {
        console.error(`❌ Error in event listener for ${event}:`, error);
      }
    });
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

  async disconnect(): Promise<void> {
    try {
      // Close presence subscription
      if (this.presenceSubscription) {
        this.presenceSubscription.close();
        this.presenceSubscription = null;
      }

      if (this.pool) {
        this.pool.close(this.defaultRelays);
      }
      this.relays.clear();
      this.connectedRelays.clear();
      this.failedRelays.clear();
      this.isInitialized = false;
      this.serviceInfo.isConnected = false;
      this.serviceInfo.isHealthy = false;
      networkStateManager.updateServiceStatus('nostr', false, false);
      console.log('🔌 Disconnected from Nostr relays');
      this.emit('disconnected');
    } catch (error) {
      console.error('❌ Failed to disconnect:', error);
    }
  }

  async retryFailedRelays(): Promise<void> {
    if (this.failedRelays.size === 0) {
      return;
    }

    console.log(`🔄 Retrying ${this.failedRelays.size} failed relays...`);
    const relaysToRetry = Array.from(this.failedRelays);
    this.failedRelays.clear();

    for (const relayUrl of relaysToRetry) {
      try {
        const relay = await this.pool!.ensureRelay(relayUrl);
        this.connectedRelays.add(relayUrl);
        console.log(`✅ Reconnected to relay: ${relayUrl}`);
      } catch (error) {
        console.warn(`⚠️ Still failing to connect to ${relayUrl}:`, error);
        this.failedRelays.add(relayUrl);
      }
    }

    console.log(`🌐 Connection status: ${this.connectedRelays.size} connected, ${this.failedRelays.size} failed`);
    this.emit('relaysUpdated', {
      connected: this.connectedRelays.size,
      failed: this.failedRelays.size
    });
  }

  async healthCheck(): Promise<{ healthy: boolean; connected: number; failed: number }> {
    const initialConnected = this.connectedRelays.size;

    // Test each connected relay
    const healthPromises = Array.from(this.connectedRelays).map(async (relayUrl) => {
      try {
        // Try a simple query to test the connection
        await this.pool!.querySync([relayUrl], { kinds: [1], limit: 1 });
        return { relayUrl, healthy: true };
      } catch (error) {
        console.warn(`⚠️ Health check failed for ${relayUrl}:`, error);
        this.connectedRelays.delete(relayUrl);
        this.failedRelays.add(relayUrl);
        return { relayUrl, healthy: false };
      }
    });

    const results = await Promise.allSettled(healthPromises);
    const healthyCount = results.filter(r =>
      r.status === 'fulfilled' && r.value.healthy
    ).length;

    const isHealthy = healthyCount > 0;

    console.log(`🏥 Health check: ${healthyCount}/${initialConnected} relays healthy`);

    return {
      healthy: isHealthy,
      connected: this.connectedRelays.size,
      failed: this.failedRelays.size
    };
  }

  private async performHealthCheckInternal(): Promise<boolean> {
    const health = await this.healthCheck();
    return health.healthy;
  }
}

export const nostrService = new NostrService();
