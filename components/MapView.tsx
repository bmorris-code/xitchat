import React, { useState, useEffect } from 'react';
import { User } from '../types';
import { bluetoothMesh, MeshNode } from '../services/bluetoothMesh';
import { geohashChannels, GeohashChannel } from '../services/geohashChannels';
import { meshPermissions } from '../services/meshPermissions';
import { wifiP2P, WiFiPeer } from '../services/wifiP2P';
import { trueMeshP2PService, RealPeer } from '../services/realP2P';
import { realtimeRadar, RadarPeer } from '../services/realtimeRadar';
import WiFiChatRoom from './WiFiChatRoom';

interface MapViewProps {
  onUserSelect: (user: User) => void;
  userLocation: { lat: number, lng: number } | null;
}

const MapView: React.FC<MapViewProps> = ({ onUserSelect, userLocation }) => {
  const [hoveredUser, setHoveredUser] = useState<User | null>(null);
  const [selectedPeer, setSelectedPeer] = useState<MeshNode | WiFiPeer | RealPeer | null>(null);
  const [selectedWiFiPeer, setSelectedWiFiPeer] = useState<WiFiPeer | null>(null);
  const [signalStrength, setSignalStrength] = useState(75);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [meshNodes, setMeshNodes] = useState<MeshNode[]>([]);
  const [wifiPeers, setWifiPeers] = useState<WiFiPeer[]>([]);
  const [realPeers, setRealPeers] = useState<RealPeer[]>([]);
  const [nearbyChannels, setNearbyChannels] = useState<GeohashChannel[]>([]);
  const [currentGeohash, setCurrentGeohash] = useState<string>('');
  const [networkStats, setNetworkStats] = useState<any>(null);
  const [isRealMode, setIsRealMode] = useState(true); // Default to TRUE for Pure Mesh Mode
  const [radarPeers, setRadarPeers] = useState<RadarPeer[]>([]);
  const [is5GNetwork, setIs5GNetwork] = useState(false);
  const [networkSelectionMode, setNetworkSelectionMode] = useState<'auto' | 'manual'>('auto');

  // Fluctuating signal for 'real-time' effect
  // Fluctuating signal removed for Pure Mesh Mode
  // useEffect(() => { ... }, []);

  // Initialize mesh and geohash data
  useEffect(() => {
    initializeRadarData();
    initializeWiFiP2P();
    initializeRealP2P();

    // Subscribe to real-time radar peers
    realtimeRadar.subscribe('peersUpdated', (peers) => {
      setRadarPeers(peers);
      setIsRealMode(realtimeRadar.isRealModeEnabled());

      // Detect 5G network status
      const connection = (navigator as any).connection;
      if (connection) {
        const is5G = connection.effectiveType === '5g' || connection.downlink > 10;
        setIs5GNetwork(is5G);
      }
    });
  }, []);

  const toggleMode = () => {
    setIsRealMode(!isRealMode);
    if (!isRealMode) {
      // Switching to real mode
      console.log('🔄 Switching to REAL mode');
      trueMeshP2PService.startDiscovery();
    } else {
      // Switching to simulated mode
      console.log('🔄 Switching to SIMULATED mode');
      trueMeshP2PService.stopDiscovery();
    }
  };

  const initializeRealP2P = async () => {
    try {
      const initialized = await trueMeshP2PService.initialize();
      if (initialized) {
        // Subscribe to real P2P events
        trueMeshP2PService.on('peerFound', (peer: RealPeer) => {
          setRealPeers(prev => [...prev, peer]);
        });

        trueMeshP2PService.on('peerLost', (peer: RealPeer) => {
          setRealPeers(prev => prev.filter(p => p.id !== peer.id));
        });

        trueMeshP2PService.on('peerConnected', (peer: RealPeer) => {
          console.log(`✅ Connected to real peer: ${peer.name}`);
          // Update peer in state
          setRealPeers(prev => prev.map(p =>
            p.id === peer.id ? { ...p, isConnected: true } : p
          ));
        });

        trueMeshP2PService.on('messageReceived', (message) => {
          console.log('📨 Real P2P message:', message);
        });

        trueMeshP2PService.on('pingReceived', (message) => {
          console.log('📡 Real P2P ping:', message);
        });
      }
    } catch (error) {
      console.error('Real P2P initialization failed:', error);
    }
  };

  const initializeRadarData = () => {
    // Initialize Bluetooth mesh
    bluetoothMesh.initialize().then(connected => {
      console.log('Bluetooth mesh initialized:', connected);
    });

    // Load mesh nodes
    const initialPeers = bluetoothMesh.getPeers();
    setMeshNodes(initialPeers);

    // Load nearby channels
    setNearbyChannels(geohashChannels.getNearbyChannels());

    // Load current geohash
    const location = geohashChannels.getCurrentLocation();
    if (location) {
      setCurrentGeohash(location.geohash);
    }

    // Load connection info
    setNetworkStats(bluetoothMesh.getConnectionInfo());

    // Subscribe to updates
    const unsubscribePeers = bluetoothMesh.subscribe('peersUpdated', (peers: MeshNode[]) => {
      setMeshNodes(peers);
    });

    return () => {
      unsubscribePeers();
    };
  };

  const initializeWiFiP2P = async () => {
    try {
      const initialized = await wifiP2P.initialize();
      if (initialized) {
        // Subscribe to WiFi P2P events
        wifiP2P.subscribe('peerFound', (peer: WiFiPeer) => {
          setWifiPeers(prev => [...prev, peer]);
        });

        wifiP2P.subscribe('peerLost', (peer: WiFiPeer) => {
          setWifiPeers(prev => prev.filter(p => p.id !== peer.id));
        });

        wifiP2P.subscribe('peerConnected', (peer: WiFiPeer) => {
          console.log(`✅ Connected to ${peer.name} via WiFi P2P`);
          // Update peer in state
          setWifiPeers(prev => prev.map(p =>
            p.id === peer.id ? { ...p, isConnected: true } : p
          ));
        });

        // Add missing event subscriptions for WiFi P2P
        wifiP2P.subscribe('messageReceived', (message: any) => {
          console.log('📨 WiFi P2P message:', message);
          // Handle incoming messages - could update state or trigger notifications
        });

        wifiP2P.subscribe('pingReceived', (message: any) => {
          console.log('📡 WiFi P2P ping:', message);
          // Handle incoming pings - could update UI or show notifications
        });
      }
    } catch (error) {
      console.error('WiFi P2P initialization failed:', error);
    }
  };

  // Helper function to safely get peer type
  const getPeerType = (peer: MeshNode | WiFiPeer | RealPeer): 'bluetooth' | 'wifi' | 'real' => {
    if ('signalStrength' in peer) return 'bluetooth';
    if ('connection' in peer && 'dataChannel' in peer) return 'real';
    return 'wifi';
  };

  // Helper function to safely get peer properties
  const getPeerProperties = (peer: MeshNode | WiFiPeer | RealPeer) => {
    const type = getPeerType(peer);
    const baseProps = {
      id: peer.id,
      handle: peer.handle,
      isConnected: (peer as any).isConnected || false
    };

    if (type === 'bluetooth') {
      const btPeer = peer as MeshNode;
      return {
        ...baseProps,
        name: btPeer.name,
        signalStrength: btPeer.signalStrength
      };
    } else if (type === 'real') {
      const realPeer = peer as RealPeer;
      return {
        ...baseProps,
        name: realPeer.name,
        connection: realPeer.connection,
        dataChannel: realPeer.dataChannel
      };
    } else {
      const wifiPeer = peer as WiFiPeer;
      return {
        ...baseProps,
        name: wifiPeer.name
      };
    }
  };
  const getVisibleNodes = () => {
    const bluetoothNodes = meshNodes.map(node => ({
      ...node,
      type: 'bluetooth' as const
    }));

    const wifiNodes = wifiPeers.map(peer => ({
      ...peer,
      type: 'wifi' as const
    }));

    const realNodes = isRealMode ? realPeers.map(peer => ({
      ...peer,
      type: 'real' as const
    })) : [];

    // Add radar peers when in real mode
    const radarNodes = isRealMode ? radarPeers.map(peer => ({
      id: peer.id,
      name: peer.name,
      handle: peer.handle,
      distance: peer.distance,
      signalStrength: peer.signalStrength || 75,
      isConnected: peer.isOnline,
      type: 'radar' as const,
      location: peer.location
    })) : [];

    return [...bluetoothNodes, ...wifiNodes, ...realNodes, ...radarNodes];
  };

  // Filter channels based on permissions
  const getVisibleChannels = () => {
    return nearbyChannels.filter(channel => {
      return geohashChannels.canViewChannel(channel);
    });
  };

  return (
    <div className="flex-1 flex flex-col bg-black p-4 md:p-6 relative pt-safe animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex justify-between items-center mb-4 md:mb-8 border-b border-[#004400] pb-4">
        <div className="min-w-0">
          <h2 className="text-lg md:text-xl font-bold glow-text truncate">geohash/radar</h2>
          <p className="text-[#006600] text-[8px] md:text-[10px] mt-1 uppercase">
            scanning zone #{currentGeohash || '428F'} | SIGNAL: {signalStrength}% |
            NODES: {meshNodes.length + wifiPeers.length + (isRealMode ? realPeers.length : 0) + radarPeers.length} | CHANNELS: {getVisibleChannels().length}
            {is5GNetwork && (
              <span className="ml-2 text-purple-400 text-[6px]">📱 5G</span>
            )}
          </p>
          <p className="text-[8px] font-bold mt-1">
            <span className={`${isRealMode ? 'text-red-500' : 'text-green-500'}`}>
              {isRealMode ? '🔴 REAL MODE' : '🟢 SIMULATED MODE'}
            </span>
          </p>
        </div>
        <div className="flex gap-2 shrink-0">
          <button
            onClick={() => setViewMode('grid')}
            className={`terminal-btn px-2 py-1 text-[10px] ${viewMode === 'grid' ? 'active' : ''}`}
          >
            grid
          </button>
          <button
            onClick={() => setViewMode('list')}
            className={`terminal-btn px-2 py-1 text-[10px] ${viewMode === 'list' ? 'active' : ''}`}
          >
            list
          </button>
          {/* Simulation Toggle Removed for Pure Mesh Mode */}
        </div>
      </div>

      {viewMode === 'grid' ? (
        /* GRID VIEW - Radar Display */
        <div className="flex-1 rounded border border-[#004400] relative overflow-hidden bg-[#00110011] shadow-[inset_0_0_50px_rgba(0,255,65,0.05)]">
          {/* Radar Visuals */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="w-full h-full opacity-10">
              <svg className="w-full h-full" viewBox="0 0 1000 1000" preserveAspectRatio="xMidYMid slice">
                <g stroke="currentColor" strokeWidth="1" fill="none">
                  {[...Array(10)].map((_, i) => (
                    <line key={`v-${i}`} x1={i * 100} y1="0" x2={i * 100} y2="1000" />
                  ))}
                  {[...Array(10)].map((_, i) => (
                    <line key={`h-${i}`} x1="0" y1={i * 100} x2="1000" y2={i * 100} />
                  ))}
                  <circle cx="500" cy="500" r="150" />
                  <circle cx="500" cy="500" r="350" />
                  <circle cx="500" cy="500" r="550" />
                </g>
              </svg>
            </div>
            <div className="absolute w-[1200px] h-[1200px] border border-current opacity-[0.05] rounded-full animate-[spin_10s_linear_infinite] bg-gradient-to-tr from-current to-transparent origin-center"></div>
          </div>

          {/* Dynamic Nodes - Bluetooth, WiFi P2P, and Real P2P */}
          {getVisibleNodes().map((node, idx) => {
            const left = 20 + (idx * 25) % 60 + '%';
            const top = 15 + (idx * 15) % 70 + '%';
            const isBluetooth = node.type === 'bluetooth';
            const isWiFi = node.type === 'wifi';
            const isReal = node.type === 'real';
            const isRadar = node.type === 'radar';
            const isConnected = (node as any).isConnected || false;
            const isClose = isBluetooth ? (node as any).signalStrength > 80 : isConnected;

            return (
              <div
                key={`${node.type}-${node.id}`}
                className="absolute transform -translate-x-1/2 -translate-y-1/2 z-10 transition-all duration-1000"
                style={{ left, top }}
              >
                <button
                  onClick={() => {
                    // Show peer interaction screen
                    setSelectedPeer(node);
                  }}
                  onMouseEnter={() => {
                    const user: User = {
                      id: node.id,
                      name: (node as any).name || `User ${(node as any).handle || 'unknown'}`,
                      handle: (node as any).handle || '@unknown',
                      avatar: `https://picsum.photos/seed/${(node as any).handle || 'unknown'}/200`,
                      mood: isBluetooth ? 'Connected via Bluetooth' : isWiFi ? 'Connected via WiFi P2P' : isReal ? 'Connected via Real P2P' : isRadar ? 'Connected via Radar' : 'Unknown',
                      moodEmoji: isBluetooth ? '📡' : isWiFi ? '📶' : isReal ? '🔴' : isRadar ? '📡' : '🔗',
                      reputation: isReal ? 950 : isBluetooth ? 750 : isRadar ? 900 : 850,
                      distance: 0,
                      status: isConnected ? 'Online' : 'Away'
                    };
                    setHoveredUser(user);
                  }}
                  onMouseLeave={() => setHoveredUser(null)}
                  className="group relative flex flex-col items-center"
                >
                  {isClose && (
                    <div className={`absolute w-12 h-12 ${isReal ? 'bg-red-400' : isRadar ? 'bg-green-400' : isBluetooth ? 'bg-current' : 'bg-cyan-400'
                      } opacity-10 rounded-full animate-ping -translate-y-1`}></div>
                  )}

                  <div className="relative">
                    <div className={`w-5 h-5 md:w-4 md:h-4 border-2 border-black rounded-sm shadow-[0_0_10px_${isReal ? '#ff0000' : isRadar ? '#00ff00' : isBluetooth ? 'currentColor' : '#00ffff'
                      }] ${isClose ? 'animate-bounce' : 'animate-pulse'
                      } ${!isConnected ?
                        'bg-red-500' :
                        isReal ? 'bg-red-400' : isRadar ? 'bg-green-400' : isBluetooth ? 'bg-current' : 'bg-cyan-400'
                      }`}></div>
                    {isConnected && (
                      <div className="absolute -top-1 -right-1 w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                    )}
                  </div>

                  <div className="mt-1 bg-black border ${
                    isReal ? 'border-red-400/50' : isRadar ? 'border-green-400/50' : isBluetooth ? 'border-current' : 'border-cyan-400/50'
                  } px-2 py-0.5 opacity-80 md:opacity-60 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                    <p className={`text-[9px] font-bold ${isReal ? 'text-red-400' : isRadar ? 'text-green-400' : isBluetooth ? 'text-current' : 'text-cyan-400'
                      } flex items-center gap-1`}>
                      {isReal ? '🔴' : isRadar ? '📡' : isBluetooth ? '📡' : '📶'} &lt;{(node as any).handle}&gt;
                      {isConnected && (
                        <span className="text-green-400 text-[7px] ml-1">
                          ●
                        </span>
                      )}
                    </p>
                  </div>
                </button>
              </div>
            );
          })}

          {/* "YOU" (Real Position Indicator) */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-12 h-12 z-20">
            <div className="absolute inset-0 border-2 border-cyan-400 rotate-45 animate-pulse shadow-[0_0_20px_rgba(0,255,255,0.2)]"></div>
            <div className="absolute inset-2 border border-cyan-400 -rotate-45"></div>
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-2 h-2 bg-cyan-400 shadow-[0_0_10px_#00ffff]"></div>
            </div>
            <div className="absolute top-full mt-2 left-1/2 -translate-x-1/2 bg-cyan-900 border border-cyan-400 px-2 py-0.5 text-[8px] font-black text-white whitespace-nowrap uppercase tracking-widest">
              You (Active Node)
            </div>
          </div>

          {/* Hover Tooltip */}
          {hoveredUser && (
            <div className="absolute bottom-6 left-6 right-6 p-4 border border-current bg-black bg-opacity-95 animate-in fade-in slide-in-from-bottom-2 z-50 md:max-w-xs shadow-2xl">
              <div className="flex gap-4">
                <div className="w-12 h-12 border border-current overflow-hidden">
                  <img src={hoveredUser.avatar} className="w-full h-full object-cover grayscale" alt="" />
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="font-bold uppercase tracking-tighter text-sm">&lt;{hoveredUser.handle}&gt;</h4>
                  <p className="text-[10px] opacity-50 truncate italic">"{hoveredUser.mood}"</p>
                  <div className="flex justify-between items-end mt-2">
                    <span className="text-[8px] font-bold opacity-30">REP: {hoveredUser.reputation || 0}</span>
                    <span className="text-[8px] font-bold opacity-30 uppercase tracking-widest">{hoveredUser.distance}km</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      ) : (
        /* LIST VIEW - Detailed Information */
        <div className="flex-1 rounded border border-[#004400] overflow-hidden bg-[#00110011] shadow-[inset_0_0_50px_rgba(0,255,65,0.05)]">
          <div className="p-4 space-y-4 overflow-y-auto max-h-full">
            {/* Bluetooth Mesh Nodes Section */}
            <div>
              <h3 className="text-sm font-bold text-green-500 mb-3 uppercase tracking-wider">bluetooth_mesh_nodes</h3>
              <div className="space-y-2">
                {meshNodes.map(node => (
                  <div key={node.id} className="border border-green-500/30 p-3 bg-[#050505] hover:bg-[#0a0a0a] transition-colors">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="relative">
                          <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                        </div>
                        <div>
                          <p className="font-bold text-green-400">{node.handle}</p>
                          <p className="text-xs opacity-60">
                            📡 Bluetooth • {node.signalStrength ? ` Signal: ${node.signalStrength}%` : 'Available'}
                          </p>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => {
                            // Open chat with Bluetooth peer
                            const user: User = {
                              id: node.id,
                              name: node.name,
                              handle: node.handle,
                              avatar: `https://picsum.photos/seed/${node.handle}/200`,
                              mood: 'Available via Bluetooth',
                              moodEmoji: '📡',
                              reputation: 750,
                              distance: 0,
                              status: 'Away'
                            };
                            onUserSelect(user);
                          }}
                          className="text-[8px] bg-green-500 text-black px-2 py-1 rounded font-bold hover:bg-green-600"
                        >
                          Chat
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* WiFi P2P Peers Section */}
            <div>
              <h3 className="text-sm font-bold text-cyan-400 mb-3 uppercase tracking-wider">wifi_p2p_peers</h3>
              <div className="space-y-2">
                {wifiPeers.map(peer => (
                  <div key={peer.id} className="border border-cyan-400/30 p-3 bg-[#050505] hover:bg-[#0a0a0a] transition-colors">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="relative">
                          <div className={`w-3 h-3 ${peer.isConnected ? 'bg-cyan-400' : 'bg-cyan-600/50'} rounded-full`}></div>
                          {peer.isConnected && (
                            <div className="absolute -top-1 -right-1 w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                          )}
                        </div>
                        <div>
                          <p className="font-bold text-cyan-400">{peer.handle}</p>
                          <p className="text-xs opacity-60">
                            📶 WiFi P2P • {peer.isConnected ? 'Connected' : 'Available'}
                          </p>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => {
                            wifiP2P.connectToPeer(peer.id);
                          }}
                          disabled={peer.isConnected}
                          className={`text-[8px] px-2 py-1 rounded font-bold ${peer.isConnected
                            ? 'bg-green-500 text-black'
                            : 'bg-cyan-500 text-white hover:bg-cyan-600'
                            }`}
                        >
                          {peer.isConnected ? 'Connected' : 'Connect'}
                        </button>
                        <button
                          onClick={() => {
                            // Open chat with WiFi peer
                            const user: User = {
                              id: peer.id,
                              name: peer.name,
                              handle: peer.handle,
                              avatar: `https://picsum.photos/seed/${peer.handle}/200`,
                              mood: 'Connected via WiFi P2P',
                              moodEmoji: '📶',
                              reputation: 850,
                              distance: 0,
                              status: peer.isConnected ? 'Online' : 'Away'
                            };
                            onUserSelect(user);
                          }}
                          className="text-[8px] bg-purple-500 text-white px-2 py-1 rounded font-bold hover:bg-purple-600"
                        >
                          Chat
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Real P2P Peers Section */}
            {isRealMode && (
              <div>
                <h3 className="text-sm font-bold text-red-400 mb-3 uppercase tracking-wider">real_p2p_peers</h3>

                {realPeers.length === 0 ? (
                  <div className="text-xs text-gray-400 p-3 border border-red-400/30 bg-[#050505]">
                    No active real P2P peers found.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {realPeers.map(peer => (
                      <div key={peer.id} className="border border-red-400/30 p-3 bg-[#050505] hover:bg-[#0a0a0a] transition-colors">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="relative">
                              <div className={`w-3 h-3 ${peer.isConnected ? 'bg-red-400' : 'bg-red-600/50'} rounded-full`}></div>
                              {peer.isConnected && (
                                <div className="absolute -top-1 -right-1 w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                              )}
                            </div>
                            <div>
                              <p className="font-bold text-red-400">{peer.handle}</p>
                              <p className="text-xs opacity-60">
                                🔴 Real P2P • {peer.isConnected ? 'Connected' : 'Available'}
                              </p>
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <button
                              onClick={() => {
                                trueMeshP2PService.connectToPeer(peer.id);
                              }}
                              disabled={peer.isConnected}
                              className={`text-[8px] px-2 py-1 rounded font-bold ${peer.isConnected
                                ? 'bg-green-500 text-black cursor-not-allowed opacity-75' // Added cursor-not-allowed and opacity
                                : 'bg-red-500 text-white hover:bg-red-600'
                                }`}
                            >
                              {peer.isConnected ? 'Connected' : 'Connect'}
                            </button>
                            <button
                              onClick={() => {
                                // Open chat with Real peer
                                const user: User = {
                                  id: peer.id,
                                  name: peer.name || peer.handle, // Added fallback for name
                                  handle: peer.handle,
                                  avatar: `https://picsum.photos/seed/${peer.handle}/200`,
                                  mood: 'Connected via Real P2P',
                                  moodEmoji: '🔴',
                                  reputation: 950,
                                  distance: 0,
                                  status: peer.isConnected ? 'Online' : 'Away'
                                };
                                onUserSelect(user);
                              }}
                              className="text-[8px] bg-orange-500 text-white px-2 py-1 rounded font-bold hover:bg-orange-600"
                            >
                              Chat
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Peer Interaction Screen */}
      {selectedPeer && (
        <div className="absolute inset-0 bg-black bg-opacity-95 z-50 flex items-center justify-center p-4">
          <div className={`bg-[#0a0a0a] border ${getPeerType(selectedPeer) === 'bluetooth' ? 'border-green-500' :
            getPeerType(selectedPeer) === 'wifi' ? 'border-cyan-400' :
              'border-red-500'
            } rounded-lg p-6 max-w-md w-full`}>
            <div className="flex items-center gap-4 mb-6">
              <div className={`w-16 h-16 border ${getPeerType(selectedPeer) === 'bluetooth' ? 'border-green-500' :
                getPeerType(selectedPeer) === 'wifi' ? 'border-cyan-400' :
                  'border-red-500'
                } rounded-full overflow-hidden`}>
                <img src={`https://picsum.photos/seed/${getPeerProperties(selectedPeer).handle}/200`} className="w-full h-full object-cover grayscale" alt="" />
              </div>
              <div className="flex-1">
                <h3 className={`text-lg font-bold ${getPeerType(selectedPeer) === 'bluetooth' ? 'text-green-500' :
                  getPeerType(selectedPeer) === 'wifi' ? 'text-cyan-400' :
                    'text-red-400'
                  }`}>{getPeerProperties(selectedPeer).handle}</h3>
                <p className="text-sm opacity-60">{getPeerProperties(selectedPeer).name}</p>
                <div className="flex items-center gap-2 mt-1">
                  <span className={`px-2 py-1 text-xs rounded ${!getPeerProperties(selectedPeer).isConnected ?
                    `${getPeerType(selectedPeer) === 'bluetooth' ? 'bg-red-500/20 text-red-400' :
                      getPeerType(selectedPeer) === 'wifi' ? 'bg-cyan-600/20 text-cyan-400' :
                        'bg-red-600/20 text-red-400'}` :
                    'bg-green-500/20 text-green-400'
                    }`}>
                    {getPeerProperties(selectedPeer).isConnected ? 'Connected' : 'Available'}
                  </span>
                  <span className="text-xs opacity-50">
                    {getPeerType(selectedPeer) === 'bluetooth' ? '📡 Bluetooth' :
                      getPeerType(selectedPeer) === 'wifi' ? '📶 WiFi P2P' :
                        '🔴 Real P2P'}
                  </span>
                </div>
              </div>
            </div>

            {/* Additional Info Section */}
            <div className="mb-6 p-3 bg-black/50 rounded border border-green-500/30">
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <span className={`${getPeerType(selectedPeer) === 'bluetooth' ? 'text-green-500' :
                    getPeerType(selectedPeer) === 'wifi' ? 'text-cyan-400' :
                      'text-red-500'}`}>Type:</span>
                  {getPeerType(selectedPeer) === 'bluetooth' ? 'Bluetooth' :
                    getPeerType(selectedPeer) === 'wifi' ? 'WiFi P2P' :
                      'Real P2P'}
                </div>
                <div>
                  <span className={`${getPeerType(selectedPeer) === 'bluetooth' ? 'text-green-500' :
                    getPeerType(selectedPeer) === 'wifi' ? 'text-cyan-400' :
                      'text-red-500'}`}>Status:</span>
                  {getPeerProperties(selectedPeer).isConnected ? 'Connected' : 'Available'}
                </div>
                <div>
                  <span className={`${getPeerType(selectedPeer) === 'bluetooth' ? 'text-green-500' :
                    getPeerType(selectedPeer) === 'wifi' ? 'text-cyan-400' :
                      'text-red-500'}`}>Last Seen:</span> Just now
                </div>
                <div>
                  <span className={`${getPeerType(selectedPeer) === 'bluetooth' ? 'text-green-500' :
                    getPeerType(selectedPeer) === 'wifi' ? 'text-cyan-400' :
                      'text-red-500'}`}>Peer ID:</span>
                  {getPeerProperties(selectedPeer).id.slice(0, 8)}...
                </div>
              </div>
            </div>

            <div className="space-y-3">
              {getPeerType(selectedPeer) === 'bluetooth' ? (
                // Bluetooth peer actions
                <>
                  <button
                    onClick={() => {
                      bluetoothMesh.sendMessage(selectedPeer.id, 'ping_request');
                      setSelectedPeer(null);
                    }}
                    className="w-full bg-green-500 hover:bg-green-600 text-black font-bold py-3 px-4 rounded transition-colors flex items-center justify-center gap-2"
                  >
                    📡 Send Ping
                  </button>

                  <button
                    onClick={() => {
                      // Convert to User and open chat
                      const user: User = {
                        id: selectedPeer.id,
                        name: getPeerProperties(selectedPeer).name,
                        handle: getPeerProperties(selectedPeer).handle,
                        avatar: `https://picsum.photos/seed/${getPeerProperties(selectedPeer).handle}/200`,
                        mood: 'Connected via Bluetooth',
                        moodEmoji: '📡',
                        reputation: 750,
                        distance: 0,
                        status: 'Online'
                      };
                      onUserSelect(user);
                      setSelectedPeer(null);
                    }}
                    className="w-full bg-blue-500 hover:bg-blue-600 text-white font-bold py-3 px-4 rounded transition-colors flex items-center justify-center gap-2"
                  >
                    💬 Open Chat
                  </button>
                </>
              ) : getPeerType(selectedPeer) === 'wifi' ? (
                // WiFi P2P peer actions
                <>
                  <button
                    onClick={() => {
                      wifiP2P.connectToPeer(selectedPeer.id);
                      setSelectedPeer(null);
                    }}
                    className="w-full bg-cyan-500 hover:bg-cyan-600 text-black font-bold py-3 px-4 rounded transition-colors flex items-center justify-center gap-2"
                  >
                    📶 Connect via WiFi P2P
                  </button>

                  <button
                    onClick={() => {
                      // Convert to User and open chat
                      const user: User = {
                        id: selectedPeer.id,
                        name: getPeerProperties(selectedPeer).name,
                        handle: getPeerProperties(selectedPeer).handle,
                        avatar: `https://picsum.photos/seed/${getPeerProperties(selectedPeer).handle}/200`,
                        mood: 'Connected via WiFi P2P',
                        moodEmoji: '📶',
                        reputation: 850,
                        distance: 0,
                        status: getPeerProperties(selectedPeer).isConnected ? 'Online' : 'Away'
                      };
                      onUserSelect(user);
                      setSelectedPeer(null);
                    }}
                    className="w-full bg-purple-500 hover:bg-purple-600 text-white font-bold py-3 px-4 rounded transition-colors flex items-center justify-center gap-2"
                  >
                    💬 Open Chat
                  </button>

                  <button
                    onClick={() => {
                      wifiP2P.sendMessage(selectedPeer.id, 'ping_request');
                      setSelectedPeer(null);
                    }}
                    className="w-full bg-blue-500 hover:bg-blue-600 text-white font-bold py-3 px-4 rounded transition-colors flex items-center justify-center gap-2"
                  >
                    📡 Ping User
                  </button>
                </>
              ) : (
                // Real P2P peer actions
                <>
                  <button
                    onClick={() => {
                      trueMeshP2PService.connectToPeer(selectedPeer.id);
                      setSelectedPeer(null);
                    }}
                    className="w-full bg-red-500 hover:bg-red-600 text-black font-bold py-3 px-4 rounded transition-colors flex items-center justify-center gap-2"
                  >
                    🔴 Connect via Real P2P
                  </button>

                  <button
                    onClick={() => {
                      // Convert to User and open chat
                      const user: User = {
                        id: selectedPeer.id,
                        name: getPeerProperties(selectedPeer).name,
                        handle: getPeerProperties(selectedPeer).handle,
                        avatar: `https://picsum.photos/seed/${getPeerProperties(selectedPeer).handle}/200`,
                        mood: 'Connected via Real P2P',
                        moodEmoji: '🔴',
                        reputation: 950,
                        distance: 0,
                        status: getPeerProperties(selectedPeer).isConnected ? 'Online' : 'Away'
                      };
                      onUserSelect(user);
                      setSelectedPeer(null);
                    }}
                    className="w-full bg-orange-500 hover:bg-orange-600 text-white font-bold py-3 px-4 rounded transition-colors flex items-center justify-center gap-2"
                  >
                    💬 Open Chat
                  </button>

                  <button
                    onClick={() => {
                      trueMeshP2PService.sendPing(selectedPeer.id);
                      setSelectedPeer(null);
                    }}
                    className="w-full bg-yellow-500 hover:bg-yellow-600 text-black font-bold py-3 px-4 rounded transition-colors flex items-center justify-center gap-2"
                  >
                    📡 Ping User
                  </button>
                </>
              )}

              <button
                onClick={() => setSelectedPeer(null)}
                className="w-full bg-gray-700 hover:bg-gray-600 text-white font-bold py-3 px-4 rounded transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* WiFi P2P Chat Room */}
      {selectedWiFiPeer && (
        <WiFiChatRoom
          peer={selectedWiFiPeer}
          onBack={() => setSelectedWiFiPeer(null)}
        />
      )}

      <div className="mt-4 grid grid-cols-2 gap-3">
        <div className="bg-[#001100] border border-[#004400] p-3">
          <p className="text-[8px] text-[#004400] uppercase font-bold mb-1">Signal Fidelity</p>
          <div className="h-1 w-full bg-[#002200] rounded-full overflow-hidden">
            <div className="h-full bg-current transition-all duration-1000" style={{ width: `${signalStrength}%` }}></div>
          </div>
        </div>
        <div className="bg-[#001100] border border-[#004400] p-3">
          <p className="text-[8px] text-[#004400] uppercase font-bold mb-1">total_peers</p>
          <p className="text-[10px] font-bold text-white">
            {meshNodes.length + wifiPeers.length} DISCOVERED
          </p>
        </div>
      </div>
    </div>
  );
};

export default MapView;
