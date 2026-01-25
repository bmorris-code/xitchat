import React, { useState, useEffect } from 'react';
import { meshDataSync, MeshDataPacket, MeshNodeStatus, MeshDataConflict } from '../services/meshDataSync';
import { bluetoothMesh } from '../services/bluetoothMesh';
import { hybridMesh, MeshConnectionType } from '../services/hybridMesh';

const MeshStatusView: React.FC = () => {
  const [isConnected, setIsConnected] = useState(false);
  const [dataPackets, setDataPackets] = useState<MeshDataPacket[]>([]);
  const [nodeStatuses, setNodeStatuses] = useState<MeshNodeStatus[]>([]);
  const [conflicts, setConflicts] = useState<MeshDataConflict[]>([]);
  const [syncStatus, setSyncStatus] = useState<'idle' | 'syncing' | 'error'>('idle');
  const [lastSyncTime, setLastSyncTime] = useState<number>(0);
  const [connectionType, setConnectionType] = useState<MeshConnectionType>('simulation');
  const [connectionInfo, setConnectionInfo] = useState<any>(null);
  const [bridgeStats, setBridgeStats] = useState({ bridgedIn: 0, bridgedOut: 0 });

  useEffect(() => {
    initializeMeshStatus();
  }, []);

  const initializeMeshStatus = async () => {
    // Initialize hybrid mesh (Bluetooth first, WebRTC fallback)
    const connType = await hybridMesh.initialize();
    setConnectionType(connType);
    setConnectionInfo(hybridMesh.getConnectionInfo());

    // Check connection status
    setIsConnected(hybridMesh.isConnectedToMesh());

    // Load current mesh data
    setDataPackets(Array.from(meshDataSync.getUserProfiles()).concat(
      meshDataSync.getChatMessages(),
      meshDataSync.getMarketplaceListings(),
      meshDataSync.getBankingTransactions()
    ));
    setNodeStatuses(meshDataSync.getNodeStatuses());
    setConflicts(meshDataSync.getConflicts());

    // Subscribe to mesh data updates
    const unsubscribeDataReceived = meshDataSync.subscribe('dataReceived', (packet) => {
      setDataPackets(prev => [packet, ...prev.slice(0, 99)]); // Keep last 100 packets
      setLastSyncTime(Date.now());
    });

    const unsubscribeNodeStatuses = meshDataSync.subscribe('nodeStatusesUpdated', (statuses) => {
      setNodeStatuses(statuses);
    });

    const unsubscribeConflicts = meshDataSync.subscribe('dataConflict', (conflict) => {
      setConflicts(prev => [conflict, ...prev.slice(0, 9)]); // Keep last 10 conflicts
    });

    const unsubscribeSyncStatus = meshDataSync.subscribe('dataBroadcasted', () => {
      setSyncStatus('syncing');
      setTimeout(() => setSyncStatus('idle'), 1000);
    });

    // Subscribe to hybrid mesh updates
    const unsubscribeHybridPeers = hybridMesh.subscribe('peersUpdated', (peers) => {
      setConnectionInfo(hybridMesh.getConnectionInfo());
    });

    const unsubscribeHybridMessages = hybridMesh.subscribe('messageReceived', (message) => {
      console.log('Hybrid mesh message received:', message);
      setBridgeStats(hybridMesh.getBridgeStats());
    });

    return () => {
      unsubscribeDataReceived();
      unsubscribeNodeStatuses();
      unsubscribeConflicts();
      unsubscribeSyncStatus();
      unsubscribeHybridPeers();
      unsubscribeHybridMessages();
    };
  };

  const formatTimestamp = (timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString();
  };

  const getPacketIcon = (type: string) => {
    switch (type) {
      case 'user_profile': return 'fa-user';
      case 'chat_message': return 'fa-message';
      case 'marketplace_listing': return 'fa-shop';
      case 'banking_transaction': return 'fa-coins';
      case 'node_status': return 'fa-wifi';
      default: return 'fa-circle';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'critical': return 'text-red-500';
      case 'high': return 'text-orange-500';
      case 'normal': return 'text-blue-500';
      case 'low': return 'text-gray-500';
      default: return 'text-white';
    }
  };

  const handleResolveConflict = (packetId: string, resolution: 'local_wins' | 'remote_wins') => {
    meshDataSync.resolveConflictManually(packetId, resolution);
    setConflicts(prev => prev.filter(c => c.packetId !== packetId));
  };

  return (
    <div className="flex-1 p-6 overflow-y-auto bg-black text-current font-mono no-scrollbar">
      {/* Header */}
      <div className="flex justify-between items-center mb-8 border-b border-current pb-4">
        <div>
          <h2 className="text-3xl font-bold uppercase tracking-tighter glow-text">mesh_status.exe</h2>
          <p className="text-[10px] font-bold opacity-50 uppercase tracking-widest text-white/30">real_time_mesh_monitor</p>
        </div>
        <div className="flex items-center gap-4">
          <div className={`w-3 h-3 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'} animate-pulse`}></div>
          <div className="text-right">
            <span className="text-sm font-bold block">
              {isConnected ? 'mesh_connected' : 'mesh_offline'}
            </span>
            <span className="text-[8px] opacity-50 uppercase">
              {connectionType === 'bluetooth' && '🔵 bluetooth'}
              {connectionType === 'webrtc' && '🔗 webrtc'}
              {connectionType === 'simulation' && '📱 simulation'}
            </span>
          </div>
        </div>
      </div>

      {/* Connection Info */}
      {connectionInfo && (
        <div className="border border-current border-opacity-20 p-4 bg-[#050505] mb-6">
          <p className="text-[8px] font-bold opacity-30 uppercase tracking-widest mb-2">connection_info</p>
          <div className="grid grid-cols-3 gap-4 text-sm">
            <div>
              <span className="opacity-50">type:</span>
              <span className="ml-2 font-bold">{connectionInfo.type}</span>
            </div>
            <div>
              <span className="opacity-50">peers:</span>
              <span className="ml-2 font-bold">{connectionInfo.peerCount}</span>
            </div>
            <div>
              <span className="opacity-50">real:</span>
              <span className={`ml-2 font-bold ${connectionInfo.isRealConnection ? 'text-green-500' : 'text-yellow-500'}`}>
                {connectionInfo.isRealConnection ? 'yes' : 'sim'}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Status Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <div className="border border-current border-opacity-20 p-4 bg-[#050505]">
          <p className="text-[8px] font-bold opacity-30 uppercase tracking-widest mb-2">active_nodes</p>
          <p className="text-2xl font-bold text-green-500">{nodeStatuses.filter(n => n.status === 'online').length}</p>
        </div>
        <div className="border border-current border-opacity-20 p-4 bg-[#050505]">
          <p className="text-[8px] font-bold opacity-30 uppercase tracking-widest mb-2">data_packets</p>
          <p className="text-2xl font-bold text-blue-500">{dataPackets.length}</p>
        </div>
        <div className="border border-current border-opacity-20 p-4 bg-[#050505]">
          <p className="text-[8px] font-bold opacity-30 uppercase tracking-widest mb-2">conflicts</p>
          <p className="text-2xl font-bold text-red-500">{conflicts.length}</p>
        </div>
        <div className="border border-current border-opacity-20 p-4 bg-[#050505]">
          <p className="text-[8px] font-bold opacity-30 uppercase tracking-widest mb-2">sync_status</p>
          <p className={`text-2xl font-bold ${syncStatus === 'syncing' ? 'text-yellow-500' : syncStatus === 'error' ? 'text-red-500' : 'text-green-500'}`}>
            {syncStatus}
          </p>
        </div>
      </div>

      {/* Bridging Status */}
      <div className="border border-cyan-500/30 bg-cyan-500/5 p-4 mb-8">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-sm font-bold uppercase text-cyan-400 flex items-center gap-2">
            <i className="fa-solid fa-bridge"></i>
            mesh_bridging_active
          </h3>
          <span className="text-[8px] bg-cyan-500 text-black px-2 py-0.5 font-black uppercase">bridge_node_v1</span>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="text-center p-3 border border-cyan-500/20 bg-black/40">
            <p className="text-[8px] opacity-50 uppercase mb-1">bridged_in (nostr &gt; local)</p>
            <p className="text-xl font-bold text-white">{bridgeStats.bridgedIn}</p>
          </div>
          <div className="text-center p-3 border border-cyan-500/20 bg-black/40">
            <p className="text-[8px] opacity-50 uppercase mb-1">bridged_out (local &gt; nostr)</p>
            <p className="text-xl font-bold text-white">{bridgeStats.bridgedOut}</p>
          </div>
        </div>
        <p className="text-[8px] opacity-30 mt-3 italic text-center uppercase tracking-widest">
          &gt; extending_network_range_via_multi_layer_routing
        </p>
      </div>

      {/* Node Statuses */}
      <div className="mb-8">
        <h3 className="text-lg font-bold uppercase mb-4">mesh_nodes</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {nodeStatuses.map(node => (
            <div key={node.nodeId} className="border border-current border-opacity-10 p-4 bg-[#050505]">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${node.status === 'online' ? 'bg-green-500' :
                    node.status === 'away' ? 'bg-yellow-500' : 'bg-red-500'
                    }`}></div>
                  <span className="font-bold text-white">{node.handle}</span>
                </div>
                <span className="text-[8px] opacity-60">v{node.dataVersion}</span>
              </div>
              <p className="text-xs opacity-60 mb-2">{node.mood}</p>
              <div className="flex flex-wrap gap-1">
                {node.capabilities.map(cap => (
                  <span key={cap} className="text-[8px] bg-current/20 px-1 py-0.5 rounded">
                    {cap}
                  </span>
                ))}
              </div>
              <p className="text-[8px] opacity-40 mt-2">
                Last seen: {formatTimestamp(node.lastSeen)}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Recent Data Packets */}
      <div className="mb-8">
        <h3 className="text-lg font-bold uppercase mb-4">recent_data_packets</h3>
        <div className="space-y-2">
          {dataPackets.slice(0, 10).map(packet => (
            <div key={packet.id} className="border border-current border-opacity-10 p-3 bg-[#050505]">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <i className={`fa-solid ${getPacketIcon(packet.type)} ${getPriorityColor(packet.priority)}`}></i>
                  <div>
                    <span className="text-sm font-bold text-white">{packet.type}</span>
                    <span className="text-xs opacity-60 ml-2">from {packet.nodeId}</span>
                  </div>
                </div>
                <div className="text-right">
                  <span className={`text-xs font-bold ${getPriorityColor(packet.priority)}`}>
                    {packet.priority}
                  </span>
                  <p className="text-[8px] opacity-40">{formatTimestamp(packet.timestamp)}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Data Conflicts */}
      {conflicts.length > 0 && (
        <div className="mb-8">
          <h3 className="text-lg font-bold uppercase mb-4 text-red-500">data_conflicts</h3>
          <div className="space-y-4">
            {conflicts.map(conflict => (
              <div key={conflict.packetId} className="border border-red-500/30 p-4 bg-red-500/10">
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <p className="font-bold text-red-400">Conflict: {conflict.conflictType}</p>
                    <p className="text-xs opacity-60">Packet ID: {conflict.packetId}</p>
                  </div>
                  <span className="text-xs bg-red-500 text-black px-2 py-1 rounded">
                    {conflict.conflictType}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-4 mb-3">
                  <div>
                    <p className="text-xs font-bold text-blue-400 mb-1">Local Data</p>
                    <pre className="text-xs opacity-60 bg-black/30 p-2 rounded">
                      {JSON.stringify(conflict.localData, null, 2).substring(0, 100)}...
                    </pre>
                  </div>
                  <div>
                    <p className="text-xs font-bold text-green-400 mb-1">Remote Data</p>
                    <pre className="text-xs opacity-60 bg-black/30 p-2 rounded">
                      {JSON.stringify(conflict.remoteData, null, 2).substring(0, 100)}...
                    </pre>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleResolveConflict(conflict.packetId, 'local_wins')}
                    className="terminal-btn px-3 py-1 text-[8px] uppercase"
                  >
                    keep_local
                  </button>
                  <button
                    onClick={() => handleResolveConflict(conflict.packetId, 'remote_wins')}
                    className="terminal-btn active px-3 py-1 text-[8px] uppercase"
                  >
                    use_remote
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Last Sync Info */}
      {lastSyncTime > 0 && (
        <div className="text-center opacity-60">
          <p className="text-xs">Last sync: {formatTimestamp(lastSyncTime)}</p>
        </div>
      )}
    </div>
  );
};

export default MeshStatusView;
