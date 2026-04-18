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

  private readonly RETRY_INTERVAL = 5000;
  private readonly MAX_RETRIES = 10;
  private readonly MESSAGE_EXPIRY = 900000; // 15 minutes
  private readonly ACK_TIMEOUT = 10000;
  private readonly MAX_RETRY_DELAY = 60000;

  // ── FIX #3: store connectivity unsub functions ──
  private connectivityUnsubs: Array<() => void> = [];

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
    // ── FIX #3: store all unsub functions ──
    const onOnline = () => {
      this.isOnline = true;
      this.retryAllPendingMessages();
    };
    window.addEventListener('online', onOnline);
    this.connectivityUnsubs.push(() => window.removeEventListener('online', onOnline));

    const onOffline = () => { this.isOnline = false; };
    window.addEventListener('offline', onOffline);
    this.connectivityUnsubs.push(() => window.removeEventListener('offline', onOffline));

    const onVisibilityChange = () => {
      if (!document.hidden) this.checkForMissedMessages();
    };
    document.addEventListener('visibilitychange', onVisibilityChange);
    this.connectivityUnsubs.push(() => document.removeEventListener('visibilitychange', onVisibilityChange));
  }

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

    this.notifyListeners('sendMessage', { messageId, content, to, transportLayer, requiresAck });
    return messageId;
  }

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
    this.receiveACK(ack).catch(() => {});
  }

  async receiveMessage(
    messageId: string,
    from: string,
    content: string,
    transportLayer: string
  ): Promise<void> {
    // ── FIX #5: downgraded to debug to avoid flooding on every message ──
    console.debug(`📩 Received message ${messageId} from ${from} via ${transportLayer}`);
    this.lastSeenTimestamp = Date.now();
    await this.sendACK(messageId, from, transportLayer as any);
    this.notifyListeners('messageReceived', { messageId, from, content, transportLayer });
  }

  async receiveACK(ack: MessageACK): Promise<void> {
    // ── FIX #5: downgraded to debug ──
    console.debug(`✅ Received ACK for message ${ack.messageId} from ${ack.from}`);

    this.receivedACKs.set(ack.messageId, ack);

    const pendingMessage = this.pendingMessages.get(ack.messageId);
    if (pendingMessage) {
      pendingMessage.acknowledged = true;
      this.pendingMessages.delete(ack.messageId);
      this.saveToStorage();

      this.notifyListeners('messageDelivered', {
        messageId: ack.messageId,
        to: ack.to,
        transportLayer: ack.transportLayer,
        retryCount: pendingMessage.retryCount
      });
    }
  }

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
    this.notifyListeners('sendACK', { ack, transportLayer });
  }

  private async retryPendingMessages(): Promise<void> {
    if (!this.isOnline || document.hidden) return;

    const now = Date.now();
    const messagesToRetry: PendingMessage[] = [];

    this.pendingMessages.forEach((message) => {
      if (message.acknowledged) return;
      const timeSinceLastRetry = now - message.lastRetry;
      const retryDelay = this.getRetryDelay(message.retryCount);
      if (timeSinceLastRetry >= retryDelay && message.retryCount < message.maxRetries) {
        messagesToRetry.push(message);
      }
    });

    // ── FIX #1: only log when there's actually something to retry ──
    if (messagesToRetry.length > 0) {
      console.log(`🔄 Retrying ${messagesToRetry.length} pending messages`);
      for (const message of messagesToRetry) {
        await this.retryMessage(message);
      }
    }
  }

  private async retryMessage(message: PendingMessage): Promise<void> {
    message.retryCount++;
    message.lastRetry = Date.now();

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

    // ── FIX #2: remove failed messages so they don't retry forever ──
    if (message.retryCount >= message.maxRetries) {
      this.pendingMessages.delete(message.id);
      this.notifyListeners('messageFailed', {
        messageId: message.id,
        to: message.to,
        error: 'Max retries exceeded'
      });
    }

    this.saveToStorage();
  }

  private getRetryDelay(retryCount: number): number {
    return Math.min(this.ACK_TIMEOUT * Math.pow(2, Math.max(0, retryCount)), this.MAX_RETRY_DELAY);
  }

  private getFallbackTransportLayers(primary: string): string[] {
    const fallbackOrder = ['nostr', 'relay', 'presence', 'webrtc', 'wifi', 'bluetooth'];
    const idx = fallbackOrder.indexOf(primary);
    if (idx === -1) return fallbackOrder;
    return [primary, ...fallbackOrder.slice(0, idx), ...fallbackOrder.slice(idx + 1)];
  }

  private async retryAllPendingMessages(): Promise<void> {
    const messages = Array.from(this.pendingMessages.values());
    for (const message of messages) {
      if (!message.acknowledged && message.retryCount < message.maxRetries) {
        message.lastRetry = 0;
        await this.retryMessage(message);
      }
    }
  }

  private async checkForMissedMessages(): Promise<void> {
    this.notifyListeners('checkMissedMessages', { since: this.lastSeenTimestamp });
  }

  private cleanupExpiredMessages(): void {
    const now = Date.now();
    const expired: string[] = [];
    this.pendingMessages.forEach((message, id) => {
      if (now - message.timestamp > this.MESSAGE_EXPIRY) expired.push(id);
    });
    expired.forEach(id => this.pendingMessages.delete(id));
    if (expired.length > 0) this.saveToStorage();
  }

  private saveToStorage(): void {
    try {
      localStorage.setItem('xitchat_message_ack', JSON.stringify({
        pendingMessages: Array.from(this.pendingMessages.entries()),
        receivedACKs: Array.from(this.receivedACKs.entries()),
        lastSeenTimestamp: this.lastSeenTimestamp
      }));
    } catch (error) {
      console.warn('Failed to save ACK data to localStorage:', error);
    }
  }

  private loadFromStorage(): void {
    try {
      const data = localStorage.getItem('xitchat_message_ack');
      if (!data) return;

      const parsed = JSON.parse(data);
      const now = Date.now();
      const rawPending: Array<[string, PendingMessage]> = Array.isArray(parsed.pendingMessages)
        ? parsed.pendingMessages
        : [];

      const filteredPending = rawPending
        .filter(([, msg]) => {
          if (!msg || typeof msg !== 'object') return false;
          if (msg.acknowledged) return false;
          // ── FIX #4: use MESSAGE_EXPIRY (5 min) instead of 60 seconds ──
          if (typeof msg.timestamp !== 'number' || now - msg.timestamp > this.MESSAGE_EXPIRY) return false;
          if (typeof msg.retryCount === 'number' && msg.retryCount >= this.MAX_RETRIES) return false;
          return true;
        })
        .sort((a, b) => (b[1].timestamp || 0) - (a[1].timestamp || 0))
        .slice(0, 10);

      this.pendingMessages = new Map(filteredPending);
      this.receivedACKs = new Map(parsed.receivedACKs || []);
      this.lastSeenTimestamp = parsed.lastSeenTimestamp || Date.now();
      this.saveToStorage();
    } catch (error) {
      console.warn('Failed to load ACK data from localStorage:', error);
    }
  }

  private generateMessageId(): string {
    return `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  getPendingMessages(): PendingMessage[] { return Array.from(this.pendingMessages.values()); }
  getPendingCount(): number { return this.pendingMessages.size; }
  isMessageAcknowledged(messageId: string): boolean { return this.pendingMessages.get(messageId)?.acknowledged || false; }

  getMessageStatus(messageId: string): 'pending' | 'acknowledged' | 'failed' | 'unknown' {
    const message = this.pendingMessages.get(messageId);
    if (!message) return 'unknown';
    if (message.acknowledged) return 'acknowledged';
    if (message.retryCount >= message.maxRetries) return 'failed';
    return 'pending';
  }

  clearAllMessages(): void {
    this.pendingMessages.clear();
    this.receivedACKs.clear();
    this.saveToStorage();
  }

  subscribe(event: string, callback: (data: any) => void): () => void {
    if (!this.listeners[event]) this.listeners[event] = [];
    this.listeners[event].push(callback);
    return () => { this.listeners[event] = this.listeners[event].filter(cb => cb !== callback); };
  }

  private notifyListeners(event: string, data: any): void {
    (this.listeners[event] || []).forEach(cb => cb(data));
  }

  destroy(): void {
    if (this.retryInterval) clearInterval(this.retryInterval);
    // ── FIX #3: remove all event listeners ──
    this.connectivityUnsubs.forEach(u => u());
    this.connectivityUnsubs = [];
    this.saveToStorage();
  }
}

export const messageACKService = new MessageACKService();
