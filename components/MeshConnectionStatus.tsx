import React, { useState, useEffect } from 'react';
import { hybridMesh, MeshConnectionType } from '../services/hybridMesh';

const MeshConnectionStatus: React.FC = () => {
  const [connectionType, setConnectionType] = useState<MeshConnectionType>('simulation');
  const [isConnected, setIsConnected] = useState(false);
  const [peerCount, setPeerCount] = useState(0);
  const [deviceInfo, setDeviceInfo] = useState<any>(null);

  useEffect(() => {
    const updateConnectionStatus = () => {
      const info = hybridMesh.getConnectionInfo();
      setConnectionType(info.type);
      setIsConnected(hybridMesh.isConnectedToMesh());
      setPeerCount(info.peerCount);
      setDeviceInfo(hybridMesh.getDeviceCompatibility());
    };

    // Initial update
    updateConnectionStatus();

    // Subscribe to peer updates
    const unsubscribe = hybridMesh.subscribe('peersUpdated', () => {
      updateConnectionStatus();
    });

    // Update status every 5 seconds
    const interval = setInterval(updateConnectionStatus, 5000);

    return () => {
      unsubscribe();
      clearInterval(interval);
    };
  }, []);

  const getConnectionIcon = () => {
    switch (connectionType) {
      case 'bluetooth': return '🔵';
      case 'webrtc': return '🔗';
      default: return '📱';
    }
  };

  const getConnectionColor = () => {
    if (!isConnected) return 'text-red-500';
    switch (connectionType) {
      case 'bluetooth': return 'text-blue-500';
      case 'webrtc': return 'text-green-500';
      default: return 'text-yellow-500';
    }
  };

  const getConnectionText = () => {
    if (!isConnected) return 'MESH OFFLINE';
    switch (connectionType) {
      case 'bluetooth': return 'BLUETOOTH MESH';
      case 'webrtc': return 'WEBRTC MESH';
      default: return 'SIMULATION MODE';
    }
  };

  return (
    <div className="flex items-center gap-2 text-xs font-mono">
      <span className={`animate-pulse ${getConnectionColor()}`}>
        {getConnectionIcon()}
      </span>
      <span className={getConnectionColor()}>
        {getConnectionText()}
      </span>
      {peerCount > 0 && (
        <span className="text-white/50">
          ({peerCount} peers)
        </span>
      )}
      {deviceInfo && (
        <span className="text-white/30 hidden md:inline">
          {deviceInfo.platform}
        </span>
      )}
    </div>
  );
};

export default MeshConnectionStatus;
