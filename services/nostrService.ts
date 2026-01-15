// Nostr Protocol Service for XitChat
// Implements decentralized global communication using Nostr relays

import * as nostrTools from 'nostr-tools';
import * as secp256k1 from '@noble/secp256k1';

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

class NostrService {
  private privateKey: string | null = null;
  private publicKey: string | null = null;
  private pool: nostrTools.SimplePool | null = null;
  private relays: nostrTools.Relay[] = [];
  private connectedRelays: Set<string> = new Set();
  private failedRelays: Set<string> = new Set();
  private peers: Map<string, NostrPeer> = new Map();
  private channels: Map<string, NostrChannel> = new Map();
  private listeners: { [key: string]: ((data: any) => void)[] } = {};
  private isInitialized = false;

  // Default public Nostr relays
  private readonly defaultRelays = [
    'wss://relay.damus.io',
    'wss://bitcoiner.social',
    // 'wss://relay.snort.social',
    'wss://nos.lol',
    'wss://relay.primal.net'
    // 'wss://relay.nostr.band',
    // 'wss://nostr.wine',
    // 'wss://relay.nostr.bg'
  ];

  async initialize(privateKey?: string): Promise<boolean> {
    try {
      console.log('🔑 Initializing Nostr service...');

      // Initialize keys
      if (privateKey) {
        this.privateKey = privateKey;
      } else {
        // Generate new key pair if none provided - use bytesToHex approach
        const secretKey = new Uint8Array(32);
        crypto.getRandomValues(secretKey);
        this.privateKey = Array.from(secretKey).map(b => b.toString(16).padStart(2, '0')).join('');
        localStorage.setItem('nostr_private_key', this.privateKey);
      }

      // Convert hex private key to public key using secp256k1
      const privateKeyBytes = new Uint8Array(this.privateKey.match(/.{1,2}/g)!.map(byte => parseInt(byte, 16)));

      // Generate real public key using secp256k1
      try {
        const publicKeyBytes = secp256k1.getPublicKey(privateKeyBytes);
        this.publicKey = Array.from(publicKeyBytes).map(b => b.toString(16).padStart(2, '0')).join('');
        console.log('✅ Generated real secp256k1 public key');
      } catch (error) {
        console.error('❌ Failed to generate public key with secp256k1:', error);
        // Fallback to mock key
        this.publicKey = 'mock_public_key_' + Array.from(privateKeyBytes.slice(0, 16)).map(b => b.toString(16).padStart(2, '0')).join('');
      }
      console.log(`🔑 Nostr public key: ${this.publicKey}`);

      // Initialize relay pool
      this.pool = new nostrTools.SimplePool();

      // Connect to relays
      await this.connectToRelays();

      // Load user profile
      await this.loadUserProfile();

      // Subscribe to relevant events
      await this.subscribeToEvents();

      this.isInitialized = true;
      console.log('✅ Nostr service initialized successfully');
      this.emit('initialized', { publicKey: this.publicKey });

      return true;
    } catch (error) {
      console.warn('⚠️ Nostr service initialization skipped (Offline Mode):', error);
      return false;
    }
  }

 private async connectToRelays(): Promise<void> {
    console.log('🌐 Connecting to Nostr relays...');

    // Process all connections in parallel
    const connectionPromises = this.defaultRelays.map(async (relayUrl) => {
      try {
        // Add a 5-second timeout so a bad relay doesn't hang the process
        const relay = await Promise.race([
            this.pool!.ensureRelay(relayUrl),
            new Promise<never>((_, reject) => 
                setTimeout(() => reject(new Error('Connection timeout')), 5000)
            )
        ]);
        
        this.relays.push(relay as nostrTools.Relay);
        this.connectedRelays.add(relayUrl);
        console.log(`✅ Connected to relay: ${relayUrl}`);
      } catch (error) {
        // Log as warning, not error, so it doesn't look critical in console
        console.warn(`⚠️ Skipped relay ${relayUrl}:`, error instanceof Error ? error.message : 'Unknown error');
        this.failedRelays.add(relayUrl);
      }
    });

    // Wait for all attempts to finish (success or fail)
    await Promise.all(connectionPromises);

    console.log(`🌐 Connected to ${this.connectedRelays.size}/${this.defaultRelays.length} relays`);
    this.emit('relaysConnected', { count: this.connectedRelays.size });
  }

  private async loadUserProfile(): Promise<void> {
    try {
      // Fetch user metadata
      const metadataEvents = await this.pool!.querySync(this.defaultRelays, {
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

  private async subscribeToEvents(): Promise<void> {
       // Only subscribe to relays that are actually connected
    const activeRelays = Array.from(this.connectedRelays);

    if (activeRelays.length === 0) {
      console.warn('⚠️ No active relays to subscribe to.');
      return;
    }
    try {
      // Subscribe to direct messages (kind 4)
      this.pool!.subscribeMany(this.defaultRelays, {
        kinds: [4], // Direct messages
        '#p': [this.publicKey!]
      }, {
        onevent: async (event) => {
          await this.handleDirectMessage(event);
        }
      });

      // Subscribe to channel messages (kind 42)
      this.pool!.subscribeMany(this.defaultRelays, {
        kinds: [42] // Channel messages
      }, {
        onevent: (event) => {
          this.handleChannelMessage(event);
        }
      });

      // Subscribe to metadata updates (kind 0)
      this.pool!.subscribeMany(this.defaultRelays, {
        kinds: [0], // Metadata
        authors: Array.from(this.peers.keys())
      }, {
        onevent: (event) => {
          this.handleMetadataUpdate(event);
        }
      });

      console.log('👂 Subscribed to Nostr events');
    } catch (error) {
      console.warn('⚠️ Failed to subscribe to events:', error);
    }
  }

  private async handleDirectMessage(event: any): Promise<void> {
    try {
      // Decrypt direct message
      const decryptedContent = await nostrTools.nip04.decrypt(this.privateKey!, event.pubkey, event.content);

      const message = {
        id: event.id,
        from: event.pubkey,
        to: this.publicKey,
        content: decryptedContent,
        timestamp: new Date(event.created_at * 1000),
        type: 'direct'
      };

      console.log(`📨 Received direct message from ${event.pubkey}`);
      this.emit('messageReceived', message);
    } catch (error) {
      console.error('❌ Failed to handle direct message:', error);
    }
  }

  private handleChannelMessage(event: any): void {
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
      console.log(`👤 Updated peer metadata: ${peer.name || event.pubkey}`);
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

      if (this.connectedRelays.size === 0) {
        console.warn('⚠️ No relays connected, attempting to reconnect...');
        await this.connectToRelays();
      }

      // Encrypt message
      const encryptedContent = await nostrTools.nip04.encrypt(this.privateKey, recipientPublicKey, content);

      // Create event
      const privateKeyBytes = new Uint8Array(this.privateKey.match(/.{1,2}/g)!.map(byte => parseInt(byte, 16)));
      const event = nostrTools.finalizeEvent({
        kind: 4, // Direct message
        created_at: Math.floor(Date.now() / 1000),
        tags: [['p', recipientPublicKey]],
        content: encryptedContent
      }, privateKeyBytes);

      // Publish to connected relays only
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

      if (successfulRelays.length > 0) {
        console.log(`📤 Sent direct message to ${recipientPublicKey} via ${successfulRelays.length} relays`);
        this.emit('messageSent', {
          id: event.id,
          to: recipientPublicKey,
          content: content,
          timestamp: new Date()
        });
        return true;
      } else {
        console.error('❌ Failed to publish to any relay');
        return false;
      }
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
      const event = nostrTools.finalizeEvent({
        kind: 42, // Channel message
        created_at: Math.floor(Date.now() / 1000),
        tags: [['e', channelId]], // Reference to channel
        content: content
      }, privateKeyBytes);

      // Publish to relays
      const promises = this.defaultRelays.map(relayUrl =>
        this.pool!.publish([relayUrl], event)
      );

      await Promise.allSettled(promises);
      console.log(`📢 Published message to channel ${channelId}`);

      this.emit('channelMessageSent', {
        id: event.id,
        channelId: channelId,
        content: content,
        timestamp: new Date()
      });

      return true;
    } catch (error) {
      console.error('❌ Failed to publish channel message:', error);
      return false;
    }
  }

  async updateProfile(metadata: { name?: string; about?: string; picture?: string }): Promise<boolean> {
    try {
      if (!this.privateKey || !this.publicKey) {
        throw new Error('Nostr service not initialized');
      }

      const privateKeyBytes = new Uint8Array(this.privateKey.match(/.{1,2}/g)!.map(byte => parseInt(byte, 16)));
      const event = nostrTools.finalizeEvent({
        kind: 0, // Metadata
        created_at: Math.floor(Date.now() / 1000),
        tags: [],
        content: JSON.stringify(metadata)
      }, privateKeyBytes);

      // Publish to relays
      const promises = this.defaultRelays.map(relayUrl =>
        this.pool!.publish([relayUrl], event)
      );

      await Promise.allSettled(promises);
      console.log('👤 Updated profile metadata');

      this.emit('profileUpdated', metadata);
      return true;
    } catch (error) {
      console.error('❌ Failed to update profile:', error);
      return false;
    }
  }

  async searchUsers(query: string): Promise<NostrPeer[]> {
    try {
      // Search for users by name or about field
      const events = await this.pool!.querySync(this.defaultRelays, {
        kinds: [0], // Metadata
        search: query,
        limit: 20
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
          console.warn('Failed to parse metadata for user:', event.pubkey);
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

  getPrivateKey(): string | null {
    return this.privateKey;
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

  async disconnect(): Promise<void> {
    try {
      if (this.pool) {
        this.pool.close(this.defaultRelays);
      }
      this.relays = [];
      this.connectedRelays.clear();
      this.failedRelays.clear();
      this.isInitialized = false;
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
}

export const nostrService = new NostrService();
