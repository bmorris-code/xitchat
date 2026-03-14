const fs = require('fs');

// Fix 1: workingBluetoothMesh.ts
let bt = fs.readFileSync('services/workingBluetoothMesh.ts', 'utf8');
const btTarget = `    if (!peer.device || !peer.device.gatt) {
      return false;
    }

    try {
      if (peer.device.gatt.connected) {
        return true;
      }
      return false;
    } catch {
      return false;
    }`;
const btReplacement = `    if (!peer.device || !peer.device.gatt) {
      return false;
    }

    console.debug('Web Bluetooth send not supported; using mesh fallback');
    return false;`;

bt = bt.replace(btTarget, btReplacement).replace(btTarget.replace(/\n/g, '\r\n'), btReplacement.replace(/\n/g, '\r\n'));
fs.writeFileSync('services/workingBluetoothMesh.ts', bt);


// Fix 6: presenceBeacon.ts
let pb = fs.readFileSync('services/presenceBeacon.ts', 'utf8');
const pbTarget = `  private generatePubkey(): string {
    // Generate a simple pubkey for demo purposes
    // In a real implementation, this would use proper cryptographic key generation
    return 'npub1' + Math.random().toString(36).substr(2, 58);
  }`;
const pbReplacement = `  private generatePubkey(): string {
    const bytes = new Uint8Array(32);
    crypto.getRandomValues(bytes);
    const hex = Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
    localStorage.setItem('xitchat_pubkey', hex);
    return hex;
  }`;

pb = pb.replace(pbTarget, pbReplacement).replace(pbTarget.replace(/\n/g, '\r\n'), pbReplacement.replace(/\n/g, '\r\n'));
fs.writeFileSync('services/presenceBeacon.ts', pb);


// Fix 3, 7, 8: wifiP2P.ts
let wifi = fs.readFileSync('services/wifiP2P.ts', 'utf8');

// Imports
wifi = wifi.replace(
  "import { networkStateManager, NetworkService } from './networkStateManager';",
  "import { networkStateManager, NetworkService } from './networkStateManager';\nimport { ICE_SERVERS } from './iceConfig';"
);
wifi = wifi.replace(
  "import { networkStateManager, NetworkService } from './networkStateManager';\r\n",
  "import { networkStateManager, NetworkService } from './networkStateManager';\r\nimport { ICE_SERVERS } from './iceConfig';\r\n"
);

// Queue map
wifi = wifi.replace(
  "  constructor() {",
  "  private pendingCandidates: Map<string, RTCIceCandidate[]> = new Map();\n\n  constructor() {"
);

// BroadcastChannel
wifi = wifi.replace(
  "this.broadcastChannel = new BroadcastChannel('xitchat-wifi');",
  "if (typeof BroadcastChannel !== 'undefined') {\n      this.broadcastChannel = new BroadcastChannel('xitchat-wifi');"
);
wifi = wifi.replace(
  "      } catch (error) {\n        console.error('Failed to parse WiFi message:', error);\n      }\n    };",
  "      } catch (error) {\n        console.error('Failed to parse WiFi message:', error);\n      }\n    };\n    } else {\n      this.broadcastChannel = null as any;\n    }"
);
wifi = wifi.replace(
  "      } catch (error) {\r\n        console.error('Failed to parse WiFi message:', error);\r\n      }\r\n    };",
  "      } catch (error) {\r\n        console.error('Failed to parse WiFi message:', error);\r\n      }\r\n    };\r\n    } else {\r\n      this.broadcastChannel = null as any;\r\n    }"
);

// ICE Servers
const iceTarget1 = `      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' }
      ]`;
wifi = wifi.replace(new RegExp(iceTarget1.replace(/[.*+?^\${}()|[\\]\\\\]/g, '\\\\$&'), 'g'), 'iceServers: ICE_SERVERS');
const iceTarget2 = iceTarget1.replace(/\n/g, '\r\n');
wifi = wifi.replace(new RegExp(iceTarget2.replace(/[.*+?^\${}()|[\\]\\\\]/g, '\\\\$&'), 'g'), 'iceServers: ICE_SERVERS');

// Handle candidate
const candTarget = `  private async handleICECandidate(message: WiFiMessage): Promise<void> {
    const peer = this.peers.get(message.from);
    if (peer && peer.connection) {
      const candidate = JSON.parse(message.content).candidate;
      try {
        await peer.connection.addIceCandidate(new RTCIceCandidate(candidate));
      } catch (e) {
        console.warn('Failed to add ICE candidate', e);
      }
    }
  }`;
const candReplacement = `  private async handleICECandidate(message: WiFiMessage): Promise<void> {
    const peer = this.peers.get(message.from);
    if (!peer) return;
    const candidate = JSON.parse(message.content).candidate;
    
    if (peer.connection && peer.connection.remoteDescription) {
      try {
        await peer.connection.addIceCandidate(new RTCIceCandidate(candidate));
      } catch (e) {
        console.warn('Failed to add ICE candidate', e);
      }
    } else {
      const queue = this.pendingCandidates.get(message.from) || [];
      queue.push(new RTCIceCandidate(candidate));
      this.pendingCandidates.set(message.from, queue);
    }
  }`;
wifi = wifi.replace(candTarget, candReplacement).replace(candTarget.replace(/\n/g, '\r\n'), candReplacement.replace(/\n/g, '\r\n'));

// Offer / Answer queue drain
const drainOfferStr = `    this.sendSignal(message.from, 'webrtc-answer', JSON.stringify({ answer }));
  }`;
const drainOfferRep = `    this.sendSignal(message.from, 'webrtc-answer', JSON.stringify({ answer }));

    const queued = this.pendingCandidates.get(message.from) || [];
    for (const c of queued) {
      await pc.addIceCandidate(c).catch(() => {});
    }
    this.pendingCandidates.delete(message.from);
  }`;
wifi = wifi.replace(drainOfferStr, drainOfferRep).replace(drainOfferStr.replace(/\n/g, '\r\n'), drainOfferRep.replace(/\n/g, '\r\n'));

const drainAnswerStr = `      await peer.connection.setRemoteDescription(new RTCSessionDescription(answer));
      console.log(\`✅ WebRTC answer applied for \${message.from}\`);
    }
  }`;
const drainAnswerRep = `      await peer.connection.setRemoteDescription(new RTCSessionDescription(answer));
      console.log(\`✅ WebRTC answer applied for \${message.from}\`);

      const queued = this.pendingCandidates.get(message.from) || [];
      for (const c of queued) {
        await peer.connection.addIceCandidate(c).catch(() => {});
      }
      this.pendingCandidates.delete(message.from);
    }
  }`;
wifi = wifi.replace(drainAnswerStr, drainAnswerRep).replace(drainAnswerStr.replace(/\n/g, '\r\n'), drainAnswerRep.replace(/\n/g, '\r\n'));

fs.writeFileSync('services/wifiP2P.ts', wifi);

console.log("Done");
