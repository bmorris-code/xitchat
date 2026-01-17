// XitChat Network Status Dashboard
// Real-time monitoring of all 5 network layers

class XitChatNetworkMonitor {
  constructor() {
    this.stats = {
      bluetooth: { connected: false, peers: 0, messages: 0 },
      webrtc: { connected: false, peers: 0, messages: 0 },
      wifi: { connected: false, peers: 0, messages: 0 },
      nostr: { connected: false, relays: 0, messages: 0 },
      broadcast: { connected: false, peers: 0, messages: 0 }
    };
    
    this.startMonitoring();
  }

  startMonitoring() {
    console.log('📊 Starting XitChat Network Monitor...');
    
    // Monitor Hybrid Mesh
    if (window.hybridMesh) {
      window.hybridMesh.subscribe('peersUpdated', (peers) => {
        const bluetoothPeers = peers.filter(p => p.connectionType === 'bluetooth');
        const webrtcPeers = peers.filter(p => p.connectionType === 'webrtc');
        const wifiPeers = peers.filter(p => p.connectionType === 'wifi');
        const broadcastPeers = peers.filter(p => p.connectionType === 'broadcast');
        
        this.stats.bluetooth.peers = bluetoothPeers.length;
        this.stats.webrtc.peers = webrtcPeers.length;
        this.stats.wifi.peers = wifiPeers.length;
        this.stats.broadcast.peers = broadcastPeers.length;
        
        this.updateDisplay();
      });

      window.hybridMesh.subscribe('messageReceived', (message) => {
        switch (message.connectionType) {
          case 'bluetooth': this.stats.bluetooth.messages++; break;
          case 'webrtc': this.stats.webrtc.messages++; break;
          case 'wifi': this.stats.wifi.messages++; break;
          case 'broadcast': this.stats.broadcast.messages++; break;
        }
        this.updateDisplay();
      });
    }

    // Monitor Nostr Service
    if (window.nostrService) {
      setInterval(() => {
        const nostrInfo = window.nostrService.getConnectionInfo();
        this.stats.nostr.connected = nostrInfo.connected || false;
        this.stats.nostr.relays = nostrInfo.relays?.length || 0;
        this.updateDisplay();
      }, 2000);
    }

    // Update display every 5 seconds
    setInterval(() => this.updateDisplay(), 5000);
  }

  updateDisplay() {
    const totalPeers = this.stats.bluetooth.peers + this.stats.webrtc.peers + 
                      this.stats.wifi.peers + this.stats.broadcast.peers;
    const totalMessages = this.stats.bluetooth.messages + this.stats.webrtc.messages + 
                        this.stats.wifi.messages + this.stats.nostr.messages + this.stats.broadcast.messages;
    
    const status = {
      overall: this.getOverallStatus(),
      totalNetworks: this.getActiveNetworkCount(),
      totalPeers,
      totalMessages,
      breakdown: {
        bluetooth: this.stats.bluetooth,
        webrtc: this.stats.webrtc,
        wifi: this.stats.wifi,
        nostr: this.stats.nostr,
        broadcast: this.stats.broadcast
      }
    };

    // Update status display if element exists
    let statusDiv = document.getElementById('xitchat-network-status');
    if (!statusDiv) {
      statusDiv = document.createElement('div');
      statusDiv.id = 'xitchat-network-status';
      statusDiv.style.cssText = `
        position: fixed;
        top: 10px;
        right: 10px;
        background: rgba(0, 0, 0, 0.9);
        color: #00ff41;
        padding: 10px;
        border-radius: 5px;
        font-family: monospace;
        font-size: 12px;
        z-index: 9999;
        max-width: 300px;
        word-wrap: break-word;
      `;
      document.body.appendChild(statusDiv);
    }

    statusDiv.innerHTML = `
      🌐 XITCHAT NETWORK STATUS
      ════════════════════════
      Overall: ${status.overall}
      Networks: ${status.totalNetworks}/5 Active
      Peers: ${status.totalPeers} Connected
      Messages: ${status.totalMessages} Sent
      
      📱 Bluetooth: ${this.getStatusIcon(this.stats.bluetooth.connected)} ${this.stats.bluetooth.peers} peers
      🌐 WebRTC: ${this.getStatusIcon(this.stats.webrtc.connected)} ${this.stats.webrtc.peers} peers  
      📡 WiFi P2P: ${this.getStatusIcon(this.stats.wifi.connected)} ${this.stats.wifi.peers} peers
      🌍 Nostr: ${this.getStatusIcon(this.stats.nostr.connected)} ${this.stats.nostr.relays} relays
      📡 Broadcast: ${this.getStatusIcon(this.stats.broadcast.connected)} ${this.stats.broadcast.peers} peers
      ══════════════════════
    `;
  }

  getStatusIcon(connected) {
    return connected ? '✅' : '❌';
  }

  getOverallStatus() {
    const activeCount = this.getActiveNetworkCount();
    if (activeCount >= 4) return 'EXCELLENT';
    if (activeCount >= 3) return 'GOOD';
    if (activeCount >= 2) return 'FAIR';
    if (activeCount >= 1) return 'POOR';
    return 'OFFLINE';
  }

  getActiveNetworkCount() {
    return [
      this.stats.bluetooth.connected,
      this.stats.webrtc.connected,
      this.stats.wifi.connected,
      this.stats.nostr.connected,
      this.stats.broadcast.connected
    ].filter(Boolean).length;
  }

  getStats() {
    return {
      ...this.stats,
      overall: this.getOverallStatus(),
      totalNetworks: this.getActiveNetworkCount()
    };
  }
}

// Auto-initialize monitor
window.xitchatNetworkMonitor = new XitChatNetworkMonitor();
console.log('📊 XitChat Network Monitor Ready');
