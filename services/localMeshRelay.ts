// ═══════════════════════════════════════════════════════════════════
// Local Mesh Relay — WebSocket client for offline cross-device chat
// ═══════════════════════════════════════════════════════════════════
// Connects to a local WebSocket relay server (mesh-relay.js) running
// on the same WiFi/USB network.  This is the ONLY transport that
// lets a laptop BROWSER and a mobile NATIVE app exchange messages
// without internet — BLE/WiFi Direct are Android-only APIs that
// browsers cannot use.
// ═══════════════════════════════════════════════════════════════════

export interface RelayPeer {
  id: string;
  handle: string;
  name?: string;
  joinedAt: number;
}

class LocalMeshRelayService {
  private ws: WebSocket | null = null;
  private clientId: string | null = null;
  private peers: Map<string, RelayPeer> = new Map();
  private listeners: { [key: string]: ((data: any) => void)[] } = {};
  private isConnectedFlag = false;
  private reconnectTimer: any = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 120; // keep trying for ~10 min
  private reconnectDelay = 5000;
  private relayUrl: string | null = null;
  private announcedIdentity = false;

  // Default ports/hosts to probe for auto-discovery
  private readonly AUTO_DISCOVER_PORTS = [4200, 4201, 8443];
  private readonly AUTO_DISCOVER_HOSTS = ['localhost', '127.0.0.1'];

  /** Try to connect to a relay.  If no URL given, auto-discover on localhost. */
  async initialize(relayUrl?: string): Promise<boolean> {
    // Check for a saved relay URL first
    const savedUrl = localStorage.getItem('xitchat_relay_url');
    const targetUrl = relayUrl || savedUrl || null;

    if (targetUrl) {
      return this.connectTo(targetUrl);
    }

    // Auto-discover: probe common localhost ports
    return this.autoDiscover();
  }

  /** Explicitly connect to a relay URL */
  async connectTo(url: string): Promise<boolean> {
    this.relayUrl = url;
    localStorage.setItem('xitchat_relay_url', url);
    return this.connect(url);
  }

  private async autoDiscover(): Promise<boolean> {
    for (const host of this.AUTO_DISCOVER_HOSTS) {
      for (const port of this.AUTO_DISCOVER_PORTS) {
        const url = `ws://${host}:${port}`;
        try {
          const success = await this.probeRelay(url, 2000);
          if (success) {
            console.log(`🔍 Local mesh relay auto-discovered at ${url}`);
            this.relayUrl = url;
            return this.connect(url);
          }
        } catch {}
      }
    }

    // Check if we're on Android — try to probe the host machine via USB bridge
    const isNativeAndroid = (window as any).Capacitor?.isNativePlatform?.() &&
      (window as any).Capacitor?.getPlatform?.() === 'android';
    if (isNativeAndroid) {
      // When connected via USB with `adb reverse tcp:4200 tcp:4200`, localhost works.
      // Also try 10.0.2.2 (Android emulator host) and common LAN gateways.
      const androidHosts = ['10.0.2.2', '192.168.1.1', '192.168.0.1', '192.168.18.3'];
      for (const host of androidHosts) {
        for (const port of this.AUTO_DISCOVER_PORTS) {
          const url = `ws://${host}:${port}`;
          try {
            const success = await this.probeRelay(url, 2000);
            if (success) {
              console.log(`🔍 Local mesh relay discovered at ${url} (Android bridge)`);
              this.relayUrl = url;
              return this.connect(url);
            }
          } catch {}
        }
      }
    }

    console.log('📡 No local mesh relay found — will retry in background');
    this.scheduleReconnect();
    return false;
  }

  /** Quick probe: open WebSocket and wait for welcome */
  private probeRelay(url: string, timeout: number): Promise<boolean> {
    return new Promise((resolve) => {
      let settled = false;
      const finish = (result: boolean) => {
        if (settled) return;
        settled = true;
        try { probe.close(); } catch {}
        resolve(result);
      };

      let probe: WebSocket;
      try {
        probe = new WebSocket(url);
      } catch {
        resolve(false);
        return;
      }

      const timer = setTimeout(() => finish(false), timeout);

      probe.onopen = () => {
        clearTimeout(timer);
        finish(true);
      };
      probe.onerror = () => { clearTimeout(timer); finish(false); };
      probe.onclose = () => { clearTimeout(timer); if (!settled) finish(false); };
    });
  }

  private async connect(url: string): Promise<boolean> {
    return new Promise((resolve) => {
      try {
        this.ws = new WebSocket(url);

        const timeout = setTimeout(() => {
          console.warn('⏱ Relay connection timed out');
          try { this.ws?.close(); } catch {}
          resolve(false);
        }, 5000);

        this.ws.onopen = () => {
          clearTimeout(timeout);
          this.isConnectedFlag = true;
          this.reconnectAttempts = 0;
          console.log(`✅ Connected to local mesh relay: ${url}`);
          this.announceIdentity();
          this.notifyListeners('connected', { url });
          resolve(true);
        };

        this.ws.onmessage = (event) => {
          this.handleMessage(event.data);
        };

        this.ws.onclose = () => {
          const wasConnected = this.isConnectedFlag;
          this.isConnectedFlag = false;
          this.clientId = null;
          this.peers.clear();
          if (wasConnected) {
            console.log('🔌 Disconnected from local mesh relay');
            this.notifyListeners('disconnected', {});
          }
          this.scheduleReconnect();
        };

        this.ws.onerror = (err) => {
          clearTimeout(timeout);
          console.debug('Relay connection error:', (err as any)?.message || 'unknown');
          resolve(false);
        };
      } catch (error) {
        console.debug('Failed to create relay WebSocket:', error);
        resolve(false);
      }
    });
  }

  private handleMessage(raw: string) {
    try {
      const data = JSON.parse(raw);

      switch (data.type) {
        case 'relay_welcome':
          this.clientId = data.clientId;
          console.log(`📡 Relay assigned ID: ${this.clientId}`);
          break;

        case 'relay_peers':
          this.peers.clear();
          (data.peers || []).forEach((p: RelayPeer) => {
            if (p.id !== this.clientId) {
              this.peers.set(p.id, p);
            }
          });
          this.notifyListeners('peersUpdated', this.getPeers());
          break;

        default:
          // Forward message to hybridMesh / app layer
          this.notifyListeners('messageReceived', {
            id: data.id || data.messageId || `relay-${Date.now()}-${Math.random().toString(36).slice(2,7)}`,
            from: data.from || data.clientId || 'relay-peer',
            content: data.content || raw,
            timestamp: data.timestamp || Date.now(),
            connectionType: 'relay',
            senderHandle: data.senderHandle,
            senderName: data.senderName,
            // Pass through the full original data for specialized handling
            _raw: data
          });
          break;
      }
    } catch {
      // Non-JSON message — still forward it
      this.notifyListeners('messageReceived', {
        id: `relay-${Date.now()}`,
        from: 'relay-peer',
        content: raw,
        timestamp: Date.now(),
        connectionType: 'relay'
      });
    }
  }

  private announceIdentity() {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    const handle = localStorage.getItem('xitchat_handle') || 'anon';
    const name = localStorage.getItem('xitchat_name') || handle;
    this.ws.send(JSON.stringify({
      type: 'relay_identity',
      handle: handle.startsWith('@') ? handle : `@${handle}`,
      name
    }));
    this.announcedIdentity = true;
  }

  /** Send a message through the relay to all connected clients */
  async sendMessage(content: string): Promise<boolean> {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return false;

    const handle = localStorage.getItem('xitchat_handle') || 'anon';
    const name = localStorage.getItem('xitchat_name') || handle;

    const payload = JSON.stringify({
      content,
      from: this.clientId || 'unknown',
      senderHandle: handle.startsWith('@') ? handle : `@${handle}`,
      senderName: name,
      timestamp: Date.now(),
      messageId: `relay-msg-${Date.now()}-${Math.random().toString(36).slice(2,7)}`
    });

    try {
      this.ws.send(payload);
      return true;
    } catch (error) {
      console.error('Failed to send via relay:', error);
      return false;
    }
  }

  private scheduleReconnect() {
    if (this.reconnectTimer) return;
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.log('🔌 Max relay reconnect attempts reached — giving up');
      return;
    }

    this.reconnectAttempts++;
    const delay = Math.min(this.reconnectDelay * Math.pow(1.5, Math.min(this.reconnectAttempts - 1, 5)), 30000);

    this.reconnectTimer = setTimeout(async () => {
      this.reconnectTimer = null;
      if (this.isConnectedFlag) return;

      if (this.relayUrl) {
        await this.connect(this.relayUrl);
      } else {
        await this.autoDiscover();
      }
    }, delay);
  }

  // ── Public API ──────────────────────────────────────────────────

  isConnected(): boolean { return this.isConnectedFlag; }
  getPeers(): RelayPeer[] { return Array.from(this.peers.values()); }
  getClientId(): string | null { return this.clientId; }
  getRelayUrl(): string | null { return this.relayUrl; }

  /** Manually set relay URL (e.g. from settings UI) */
  setRelayUrl(url: string) {
    this.relayUrl = url;
    localStorage.setItem('xitchat_relay_url', url);
    // Reconnect immediately
    this.disconnect();
    this.connect(url);
  }

  disconnect() {
    if (this.reconnectTimer) { clearTimeout(this.reconnectTimer); this.reconnectTimer = null; }
    if (this.ws) { try { this.ws.close(); } catch {} this.ws = null; }
    this.isConnectedFlag = false;
    this.clientId = null;
    this.peers.clear();
  }

  subscribe(event: string, callback: (data: any) => void): () => void {
    if (!this.listeners[event]) this.listeners[event] = [];
    this.listeners[event].push(callback);
    return () => { this.listeners[event] = this.listeners[event].filter(cb => cb !== callback); };
  }

  private notifyListeners(event: string, data: any) {
    (this.listeners[event] || []).forEach(cb => { try { cb(data); } catch (e) { console.warn('[relay] listener error', e); } });
  }
}

export const localMeshRelay = new LocalMeshRelayService();
