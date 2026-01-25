
import React, { useState, useEffect } from 'react';
import { hybridMesh, MeshConnectionType } from '../services/hybridMesh';
import { nostrService } from '../services/nostrService';
import { bluetoothMesh } from '../services/bluetoothMesh';
import { geohashChannels } from '../services/geohashChannels';

const MeshConnectionStatus: React.FC = () => {
  const [connectionType, setConnectionType] = useState<MeshConnectionType>('simulation');
  const [isConnected, setIsConnected] = useState(false);
  const [peerCount, setPeerCount] = useState(0);
  const [deviceInfo, setDeviceInfo] = useState<any>(null);
  const [nostrStatus, setNostrStatus] = useState({ connected: false, relays: 0 });
  const [isTransmitting, setIsTransmitting] = useState(false);
  const [signalFidelity, setSignalFidelity] = useState(75);
  const [currentGeohash, setCurrentGeohash] = useState('');

  useEffect(() => {
    const updateConnectionStatus = () => {
      const info = hybridMesh.getConnectionInfo();
      const btStats = bluetoothMesh.getNetworkStats();
      const location = geohashChannels.getCurrentLocation();

      // Determine primary connection type from active services
      const activeServices = info.activeServices;
      let primaryType: MeshConnectionType = 'simulation';
      
      if (activeServices.bluetooth) primaryType = 'bluetooth';
      else if (activeServices.webrtc) primaryType = 'webrtc';
      else if (activeServices.wifi) primaryType = 'wifi';
      else if (activeServices.nostr) primaryType = 'nostr';
      else if (activeServices.broadcast) primaryType = 'broadcast';
      else if (activeServices.local) primaryType = 'local';

      setConnectionType(primaryType);
      setIsConnected(hybridMesh.isConnectedToMesh());
      setPeerCount(info.peerCount);
      setDeviceInfo(hybridMesh.getDeviceCompatibility());
      setNostrStatus({
        connected: nostrService.isConnected(),
        relays: nostrService.getConnectionInfo().relayCount
      });
      setSignalFidelity(Math.floor(Math.random() * 10 + 70)); // Simulated fidelity for now
      if (location) setCurrentGeohash(location.geohash);
    };

    // Initial update
    updateConnectionStatus();

    // Subscribe to hybrid mesh updates
    const unsubscribeHybrid = hybridMesh.subscribe('peersUpdated', () => {
      updateConnectionStatus();
    });

    // Subscribe to Nostr updates
    const unsubscribeNostr = nostrService.subscribe('relaysConnected', () => {
      updateConnectionStatus();
    });

    // Subscribe to transmission activity
    const unsubscribeTx = bluetoothMesh.subscribe('messageSent', () => {
      setIsTransmitting(true);
      setTimeout(() => setIsTransmitting(false), 500);
    });

    const unsubscribeRx = bluetoothMesh.subscribe('messageReceived', () => {
      setIsTransmitting(true);
      setTimeout(() => setIsTransmitting(false), 500);
    });

    // Update status every 5 seconds for general health
    const interval = setInterval(updateConnectionStatus, 5000);

    return () => {
      unsubscribeHybrid();
      unsubscribeNostr();
      unsubscribeTx();
      unsubscribeRx();
      clearInterval(interval);
    };
  }, []);

  const getConnectionIcon = () => {
    if (isTransmitting) return '📡';
    switch (connectionType) {
      case 'bluetooth': return '🔵';
      case 'webrtc': return '🔗';
      case 'wifi': return '📶';
      case 'nostr': return '🌐';
      case 'broadcast': return '📡';
      case 'local': return '🏠';
      default: return '📱';
    }
  };

  const getConnectionColor = () => {
    if (!isConnected) return 'text-red-500';
    switch (connectionType) {
      case 'bluetooth': return 'text-[#00ff41]';
      case 'webrtc': return 'text-cyan-400';
      case 'wifi': return 'text-green-400';
      case 'nostr': return 'text-purple-400';
      case 'broadcast': return 'text-orange-400';
      case 'local': return 'text-blue-400';
      default: return 'text-yellow-500';
    }
  };

  const getConnectionText = () => {
    if (!isConnected) return 'MESH OFFLINE';
    switch (connectionType) {
      case 'bluetooth': return 'BLUETOOTH MESH';
      case 'webrtc': return 'WEBRTC MESH';
      case 'wifi': return 'WIFI P2P';
      case 'nostr': return 'NOSTR MESH';
      case 'broadcast': return 'BROADCAST MESH';
      case 'local': return 'LOCAL MESH';
      default: return 'SIMULATION MODE';
    }
  };

  return (
    <div className="flex items-center gap-4 text-[10px] font-mono uppercase tracking-widest">
      <div className="flex items-center gap-2">
        <span className={`animate-pulse ${getConnectionColor()}`}>
          {getConnectionIcon()}
        </span>
        <span className={`${getConnectionColor()} font-bold`}>
          {getConnectionText()}
        </span>
      </div>

      <div className="h-3 w-[1px] bg-white/10 hidden md:block"></div>

      <div className="hidden md:flex items-center gap-3">
        <div className="flex items-center gap-1.5">
          <span className="opacity-30">PEERS:</span>
          <span className="text-white font-bold">{peerCount}</span>
        </div>

        <div className="flex items-center gap-1.5">
          <span className="opacity-30">NOSTR:</span>
          <span className={nostrStatus.connected ? 'text-[#00ff41]' : 'text-red-500'}>
            {nostrStatus.connected ? `${nostrStatus.relays} RELAYS` : 'OFFLINE'}
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          <span className="opacity-30">ZONE:</span>
          <span className="text-white font-bold">#{currentGeohash || 'K0'}</span>
        </div>

        <div className="flex items-center gap-2">
          <span className="opacity-30">SIGNAL:</span>
          <div className="w-12 h-1.5 bg-white/5 rounded-full overflow-hidden border border-white/10">
            <div
              className="h-full bg-[#00ff41] shadow-[0_0_5px_#00ff41] transition-all duration-500"
              style={{ width: `${signalFidelity}%` }}
            ></div>
          </div>
        </div>
      </div>

      {isTransmitting && (
        <div className="flex items-center gap-1 text-[8px] text-[#00ff41] animate-pulse">
          <span className="w-1 h-1 bg-[#00ff41] rounded-full"></span>
          <span>TX/RX_ACTIVE</span>
        </div>
      )}
    </div>
  );
};

export default MeshConnectionStatus;
