// Message ACK + Replay Service for XitChat
// Handles message delivery confirmation and replay for mobile sleep scenarios

export interface MessageACK {
  messageId: string;
  from: string;
  to: string;
  timestamp: number;
  acknowledged: boolean;
  retryCount: number;
  maxRetries: number;
  transportLayer: 'webrtc' | 'nostr' | 'bluetooth' | 'wifi' | 'presence' | 'relay';
}

export interface PendingMessage {
  id: string;
  from: string;
  to: string;
  content: string;
  timestamp: number;
  retryCount: number;
  maxRetries: number;
  lastRetry: number;
  transportLayer: 'webrtc' | 'nostr' | 'bluetooth' | 'wifi' | 'presence' | 'relay';
  requiresAck: boolean;
  acknowledged: boolean;
}

class MessageACKService {
  private pendingMessages: Map<string, PendingMessage> = new Map();
  private receivedACKs: Map<string, MessageACK> = new Map();
  private listeners: { [key: string]: ((data: any) => void)[] } = {};
  private retryInterval: any = null;
  private isOnline = true;
  private lastSeenTimestamp = Date.now();
  
  // Configuration
  private readonly RETRY_INTERVAL = 5000; // 5 seconds
  private readonly MAX_RETRIES = 3;
  private readonly MESSAGE_EXPIRY = 300000; // 5 minutes
  private readonly ACK_TIMEOUT = 10000; // Base timeout for ACK retries
  private readonly MAX_RETRY_DELAY = 60000; // 60 seconds cap

  constructor() {
    this.setupRetryMechanism();
    this.setupConnectivityMonitoring();
    this.loadFromStorage();
  }

  private setupRetryMechanism() {
    this.retryInterval = setInterval(() => {
      this.retryPendingMessages();
      this.cleanupExpiredMessages();
    }, this.RETRY_INTERVAL);
  }

  private setupConnectivityMonitoring() {
    // Monitor online/offline status
    window.addEventListener('online', () => {
      console.log('📡 Connection restored, retrying pending messages');
      this.isOnline = true;
      this.retryAllPendingMessages();
    });

    window.addEventListener('offline', () => {
      console.log('📡 Connection lost, pausing retries');
      this.isOnline = false;
    });

    // Monitor page visibility for mobile sleep detection
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) {
        console.log('📱 App became visible, checking for missed messages');
        this.checkForMissedMessages();
      }
    });
  }

  // Send a message with ACK requirement
  async sendMessage(
    content: string,
    to: string,
    transportLayer: 'webrtc' | 'nostr' | 'bluetooth' | 'wifi' | 'presence' | 'relay' = 'nostr',
    requiresAck: boolean = true
  ): Promise<string> {
    const messageId = this.generateMessageId();
    const pendingMessage: PendingMessage = {
      id: messageId,
      from: 'me',
      to,
      content,
      timestamp: Date.now(),
      retryCount: 0,
      maxRetries: this.MAX_RETRIES,
      lastRetry: Date.now(),
      transportLayer,
      requiresAck,
      acknowledged: false
    };

    if (requiresAck) {
      this.pendingMessages.set(messageId, pendingMessage);
      this.saveToStorage();
    }

    console.log(`📨 Sending message ${messageId} via ${transportLayer} (ACK required: ${requiresAck})`);
    
    // Emit message for transport layer to handle
    this.notifyListeners('sendMessage', {
      messageId,
      content,
      to,
      transportLayer,
      requiresAck
    });

    return messageId;
  }

  // Track an outgoing message sent by another transport service (hybrid mesh, nostr, etc.)
  trackOutgoingMessage(
    messageId: string,
    to: string,
    content: string,
    transportLayer: 'webrtc' | 'nostr' | 'bluetooth' | 'wifi' | 'presence' | 'relay' = 'relay',
    requiresAck: boolean = true
  ): void {
    if (!requiresAck) return;

    const pendingMessage: PendingMessage = {
      id: messageId,
      from: 'me',
      to,
      content,
      timestamp: Date.now(),
      retryCount: 0,
      maxRetries: this.MAX_RETRIES,
      lastRetry: Date.now(),
      transportLayer,
      requiresAck,
      acknowledged: false
    };

    this.pendingMessages.set(messageId, pendingMessage);
    this.saveToStorage();
  }

  markMessageDelivered(
    messageId: string,
    to: string,
    transportLayer: 'webrtc' | 'nostr' | 'bluetooth' | 'wifi' | 'presence' | 'relay' = 'relay'
  ): void {
    const ack: MessageACK = {
      messageId,
      from: to,
      to: 'me',
      timestamp: Date.now(),
      acknowledged: true,
      retryCount: 0,
      maxRetries: this.MAX_RETRIES,
      transportLayer
    };
    this.receiveACK(ack).catch(() => { });
  }

  // Handle incoming message
  async receiveMessage(
    messageId: string,
    from: string,
    content: string,
    transportLayer: string
  ): Promise<void> {
    console.log(`📩 Received message ${messageId} from ${from} via ${transportLayer}`);

    // Update last seen timestamp
    this.lastSeenTimestamp = Date.now();

    // Send ACK immediately
    await this.sendACK(messageId, from, transportLayer as any);

    // Emit message received event
    this.notifyListeners('messageReceived', {
      messageId,
      from,
      content,
      transportLayer
    });
  }

  // Handle incoming ACK
  async receiveACK(ack: MessageACK): Promise<void> {
    console.log(`✅ Received ACK for message ${ack.messageId} from ${ack.from}`);

    // Store the ACK
    this.receivedACKs.set(ack.messageId, ack);

    // Remove from pending messages
    const pendingMessage = this.pendingMessages.get(ack.messageId);
    if (pendingMessage) {
      pendingMessage.acknowledged = true;
      this.pendingMessages.delete(ack.messageId);
      this.saveToStorage();

      // Notify about successful delivery
      this.notifyListeners('messageDelivered', {
        messageId: ack.messageId,
        to: ack.to,
        transportLayer: ack.transportLayer,
        retryCount: pendingMessage.retryCount
      });
    }
  }

  // Send ACK for received message
  private async sendACK(
    messageId: string,
    to: string,
    transportLayer: 'webrtc' | 'nostr' | 'bluetooth' | 'wifi' | 'presence' | 'relay'
  ): Promise<void> {
    const ack: MessageACK = {
      messageId,
      from: 'me',
      to,
      timestamp: Date.now(),
      acknowledged: true,
      retryCount: 0,
      maxRetries: this.MAX_RETRIES,
      transportLayer
    };

    console.log(`📤 Sending ACK for message ${messageId} to ${to} via ${transportLayer}`);

    // Emit ACK for transport layer to handle
    this.notifyListeners('sendACK', {
      ack,
      transportLayer
    });
  }

  // Retry pending messages
  private async retryPendingMessages(): Promise<void> {
    if (!this.isOnline) return;
    if (document.hidden) return;

    const now = Date.now();
    const messagesToRetry: PendingMessage[] = [];

    this.pendingMessages.forEach((message) => {
      if (message.acknowledged) return;

      const timeSinceLastRetry = now - message.lastRetry;
      const retryDelay = this.getRetryDelay(message.retryCount);
      const shouldRetry = timeSinceLastRetry >= retryDelay;

      if (shouldRetry && message.retryCount < message.maxRetries) {
        messagesToRetry.push(message);
      }
    });

    console.log(`🔄 Retrying ${messagesToRetry.length} pending messages`);

    for (const message of messagesToRetry) {
      await this.retryMessage(message);
    }
  }

  // Retry a specific message
  private async retryMessage(message: PendingMessage): Promise<void> {
    message.retryCount++;
    message.lastRetry = Date.now();

    console.log(`🔄 Retrying message ${message.id} (attempt ${message.retryCount}/${message.maxRetries})`);

    // Retry using one transport per attempt to avoid multi-layer send storms
    const fallbackLayers = this.getFallbackTransportLayers(message.transportLayer);
    const transportIndex = Math.min(message.retryCount - 1, fallbackLayers.length - 1);
    const transportLayer = fallbackLayers[transportIndex];

    try {
      this.notifyListeners('sendMessage', {
        messageId: message.id,
        content: message.content,
        to: message.to,
        transportLayer,
        requiresAck: true,
        isRetry: true,
        retryCount: message.retryCount
      });
    } catch (error) {
      console.warn(`Retry failed for message ${message.id} via ${transportLayer}:`, error);
    }

    this.saveToStorage();

    // Mark as failed if max retries reached
    if (message.retryCount >= message.maxRetries) {
      console.warn(`Message ${message.id} not acknowledged after ${message.maxRetries} retries`);
      this.notifyListeners('messageFailed', {
        messageId: message.id,
        to: message.to,
        error: 'Max retries exceeded'
      });
    }
  }

  private getRetryDelay(retryCount: number): number {
    const exp = Math.max(0, retryCount);
    return Math.min(this.ACK_TIMEOUT * Math.pow(2, exp), this.MAX_RETRY_DELAY);
  }

  // Get fallback transport layers
  private getFallbackTransportLayers(primary: string): string[] {
    const fallbackOrder = [
      'nostr',     // Most reliable for mobile
      'relay',     // Server fallback
      'presence',  // Presence beacon
      'webrtc',   // Direct P2P
      'wifi',      // Local mesh
      'bluetooth' // Local mesh
    ];

    const primaryIndex = fallbackOrder.indexOf(primary);
    if (primaryIndex === -1) return fallbackOrder;

    // Return primary first, then fallbacks in order
    return [primary, ...fallbackOrder.slice(0, primaryIndex), ...fallbackOrder.slice(primaryIndex + 1)];
  }

  // Retry all pending messages (called when connection is restored)
  private async retryAllPendingMessages(): Promise<void> {
    const messages = Array.from(this.pendingMessages.values());
    for (const message of messages) {
      if (!message.acknowledged && message.retryCount < message.maxRetries) {
        message.lastRetry = 0; // Force immediate retry
        await this.retryMessage(message);
      }
    }
  }

  // Check for missed messages when app becomes visible
  private async checkForMissedMessages(): Promise<void> {
    // This would integrate with presence beacon or other services
    // to fetch messages sent while the app was asleep
    console.log('🔍 Checking for missed messages since last seen:', new Date(this.lastSeenTimestamp));
    
    this.notifyListeners('checkMissedMessages', {
      since: this.lastSeenTimestamp
    });
  }

  // Clean up expired messages
  private cleanupExpiredMessages(): void {
    const now = Date.now();
    const expiredMessages: string[] = [];

    this.pendingMessages.forEach((message, messageId) => {
      if (now - message.timestamp > this.MESSAGE_EXPIRY) {
        expiredMessages.push(messageId);
      }
    });

    expiredMessages.forEach(messageId => {
      this.pendingMessages.delete(messageId);
      console.log(`🗑️ Removed expired message: ${messageId}`);
    });

    if (expiredMessages.length > 0) {
      this.saveToStorage();
    }
  }

  // Storage management
  private saveToStorage(): void {
    try {
      const data = {
        pendingMessages: Array.from(this.pendingMessages.entries()),
        receivedACKs: Array.from(this.receivedACKs.entries()),
        lastSeenTimestamp: this.lastSeenTimestamp
      };
      localStorage.setItem('xitchat_message_ack', JSON.stringify(data));
    } catch (error) {
      console.warn('Failed to save ACK data to localStorage:', error);
    }
  }

  private loadFromStorage(): void {
    try {
      const data = localStorage.getItem('xitchat_message_ack');
      if (data) {
        const parsed = JSON.parse(data);
        const now = Date.now();
        const rawPending: Array<[string, PendingMessage]> = Array.isArray(parsed.pendingMessages) ? parsed.pendingMessages : [];
        const filteredPending = rawPending
          .filter(([, msg]) => {
            if (!msg || typeof msg !== 'object') return false;
            if (msg.acknowledged) return false;
            if (typeof msg.timestamp !== 'number' || now - msg.timestamp > 60000) return false;
            if (typeof msg.retryCount === 'number' && msg.retryCount >= this.MAX_RETRIES) return false;
            return true;
          })
          .sort((a, b) => (b[1].timestamp || 0) - (a[1].timestamp || 0))
          .slice(0, 10);

        this.pendingMessages = new Map(filteredPending);
        this.receivedACKs = new Map(parsed.receivedACKs || []);
        this.lastSeenTimestamp = parsed.lastSeenTimestamp || Date.now();
        this.saveToStorage();
        
        console.log(`📂 Loaded ${this.pendingMessages.size} pending messages from storage`);
      }
    } catch (error) {
      console.warn('Failed to load ACK data from localStorage:', error);
    }
  }

  // Utility methods
  private generateMessageId(): string {
    return `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // Public API
  getPendingMessages(): PendingMessage[] {
    return Array.from(this.pendingMessages.values());
  }

  getPendingCount(): number {
    return this.pendingMessages.size;
  }

  isMessageAcknowledged(messageId: string): boolean {
    const message = this.pendingMessages.get(messageId);
    return message?.acknowledged || false;
  }

  getMessageStatus(messageId: string): 'pending' | 'acknowledged' | 'failed' | 'unknown' {
    const message = this.pendingMessages.get(messageId);
    if (!message) return 'unknown';
    if (message.acknowledged) return 'acknowledged';
    if (message.retryCount >= message.maxRetries) return 'failed';
    return 'pending';
  }

  // Clear all pending messages (call when user logs out)
  clearAllMessages(): void {
    this.pendingMessages.clear();
    this.receivedACKs.clear();
    this.saveToStorage();
    console.log('🗑️ Cleared all message ACK data');
  }

  subscribe(event: string, callback: (data: any) => void): () => void {
    if (!this.listeners[event]) this.listeners[event] = [];
    this.listeners[event].push(callback);
    return () => {
      this.listeners[event] = this.listeners[event].filter(cb => cb !== callback);
    };
  }

  private notifyListeners(event: string, data: any): void {
    if (this.listeners[event]) {
      this.listeners[event].forEach(callback => callback(data));
    }
  }

  // Cleanup
  destroy(): void {
    if (this.retryInterval) {
      clearInterval(this.retryInterval);
    }
    this.saveToStorage();
  }
}

export const messageACKService = new MessageACKService();

