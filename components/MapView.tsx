
import React, { useState, useEffect } from 'react';
import { User } from '../types';
import { hybridMesh, HybridMeshPeer } from '../services/hybridMesh';
import { geohashChannels, GeohashChannel } from '../services/geohashChannels';

interface MapViewProps {
  onUserSelect: (user: User) => void;
  userLocation: { lat: number, lng: number } | null;
}

const MapView: React.FC<MapViewProps> = ({ onUserSelect, userLocation }) => {
  const [hoveredUser, setHoveredUser] = useState<User | null>(null);
  const [selectedPeer, setSelectedPeer] = useState<HybridMeshPeer | null>(null);
  const [signalStrength, setSignalStrength] = useState(75);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [peers, setPeers] = useState<HybridMeshPeer[]>([]);
  const [nearbyChannels, setNearbyChannels] = useState<GeohashChannel[]>([]);
  const [currentGeohash, setCurrentGeohash] = useState<string>('');
  const [isRealMode, setIsRealMode] = useState(true);
  const [is5GNetwork, setIs5GNetwork] = useState(false);

  useEffect(() => {
    // Initialize view with current mesh state
    setPeers(hybridMesh.getPeers());

    // Subscribe to hybrid mesh updates (single source of truth for all layers)
    const unsubscribeMesh = hybridMesh.subscribe('peersUpdated', (updatedPeers: HybridMeshPeer[]) => {
      console.log('🗺️ Radar received peer update:', updatedPeers.length, 'peers');
      setPeers(updatedPeers);

      // Update network status indicators
      const connection = (navigator as any).connection;
      if (connection) {
        const is5G = connection.effectiveType === '5g' || connection.downlink > 10;
        setIs5GNetwork(is5G);
      }
    });

    // Initialize Geohash logic
    const location = geohashChannels.getCurrentLocation();
    if (location) {
      setCurrentGeohash(location.geohash);
    }
    setNearbyChannels(geohashChannels.getNearbyChannels());

    return () => {
      unsubscribeMesh();
    };
  }, []);

  const getPercentageColor = (percentage: number) => {
    if (percentage > 70) return '#00ff41'; // Green
    if (percentage > 40) return '#ffff00'; // Yellow
    return '#ff0000'; // Red
  };

  const getVisibleNodes = () => {
    return peers.map(peer => ({
      ...peer,
      type: peer.connectionType,
      // Ensure compatibility with UI expectations
      signalStrength: peer.signalStrength || 75
    }));
  };

  const getVisibleChannels = () => {
    return nearbyChannels.filter(channel => geohashChannels.canViewChannel(channel));
  };

  return (
    <div className="flex-1 flex flex-col bg-black p-4 md:p-6 relative pt-safe animate-in fade-in duration-500 font-mono no-scrollbar">
      {/* Header */}
      <div className="flex justify-between items-center mb-4 md:mb-8 border-b border-[#004400] pb-4">
        <div className="min-w-0">
          <h2 className="text-3xl font-bold glow-text truncate lowercase text-[#00ff41]">geohash/radar</h2>
          <p className="text-[#006600] text-[8px] md:text-[10px] mt-1 uppercase font-bold">
            SCANNING ZONE #{currentGeohash || 'K0'} | SIGNAL: {signalStrength}% |
            NODES: {getVisibleNodes().length} | CHANNELS: {getVisibleChannels().length}
            {is5GNetwork && (
              <span className="ml-2 text-purple-400 text-[6px]">📱 5G</span>
            )}
          </p>
          <p className="text-[8px] font-bold mt-1 flex items-center gap-2">
            <span className={`w-2 h-2 rounded-full ${isRealMode ? 'bg-red-500' : 'bg-green-500'}`}></span>
            <span className={`${isRealMode ? 'text-red-500' : 'text-green-500'} lowercase`}>
              {isRealMode ? 'real mode' : 'degraded mode'}
            </span>
          </p>
        </div>
        <div className="flex gap-2 shrink-0">
          <button
            onClick={() => setViewMode('grid')}
            className={`terminal-btn px-4 py-1 text-[10px] lowercase ${viewMode === 'grid' ? 'active' : ''}`}
          >
            grid
          </button>
          <button
            onClick={() => setViewMode('list')}
            className={`terminal-btn px-4 py-1 text-[10px] lowercase ${viewMode === 'list' ? 'active' : ''}`}
          >
            list
          </button>
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

          {/* YOU - Light Blue Center Node */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-20">
            <div className="w-8 h-8 bg-[#00BFFF] border-2 border-white shadow-[0_0_20px_rgba(0,191,255,0.6)]"></div>
            <div className="absolute top-full mt-3 left-1/2 -translate-x-1/2 bg-black border border-[#00BFFF] px-3 py-1 text-[10px] font-black text-[#00BFFF] whitespace-nowrap uppercase tracking-wider">
              YOU (ACTIVE NODE)
            </div>
          </div>

          {/* Dynamic User Nodes - Red Squares in Circular Pattern */}
          {getVisibleNodes().map((node, idx) => {
            const type = node.type;
            const isConnected = node.isConnected;

            // Calculate circular position
            const angle = (idx / Math.max(getVisibleNodes().length - 1, 1)) * 2 * Math.PI;
            const radius = 120; // Distance from center
            const centerX = 50; // Center percentage
            const centerY = 50; // Center percentage

            const nodeLeft = centerX + (Math.cos(angle) * radius / 5); // Convert to percentage
            const nodeTop = centerY + (Math.sin(angle) * radius / 5);

            return (
              <div
                key={`${type}-${node.id}`}
                className="absolute transform -translate-x-1/2 -translate-y-1/2 z-10 transition-all duration-1000"
                style={{ left: `${nodeLeft}%`, top: `${nodeTop}%` }}
              >
                <button
                  onClick={() => setSelectedPeer(node)}
                  onMouseEnter={() => {
                    setHoveredUser({
                      id: node.id,
                      name: node.name || node.handle,
                      handle: node.handle,
                      avatar: `https://picsum.photos/seed/${node.handle}/200`,
                      mood: `Connected via ${type.toUpperCase()}`,
                      moodEmoji: '📡',
                      reputation: 800,
                      distance: 0,
                      status: isConnected ? 'Online' : 'Away'
                    });
                  }}
                  onMouseLeave={() => setHoveredUser(null)}
                  className="group relative flex flex-col items-center"
                >
                  {/* Red Square Node */}
                  <div className="relative">
                    <div className={`w-6 h-6 border-2 border-white shadow-[0_0_15px_rgba(255,0,0,0.6)] ${isConnected ? 'bg-red-500' : 'bg-red-800'} animate-pulse`}></div>
                    {isConnected && (
                      <div className="absolute -top-1 -right-1 w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                    )}
                  </div>

                  <div className="mt-2 bg-black border border-red-500 px-2 py-1 opacity-80 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                    <p className="text-[10px] font-black text-red-400 flex items-center gap-1">
                      &lt;{node.handle}&gt;
                    </p>
                  </div>
                </button>
              </div>
            );
          })}

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
        /* LIST VIEW - Categorized as per image */
        <div className="flex-1 rounded border border-[#004400] overflow-hidden bg-[#00110011] shadow-[inset_0_0_50px_rgba(0,255,65,0.05)]">
          <div className="p-4 space-y-8 overflow-y-auto max-h-full no-scrollbar">
            {/* Bluetooth */}
            <div>
              <h3 className="text-sm font-bold text-[#00ff41] mb-3 uppercase tracking-wider">BLUETOOTH_MESH_NODES</h3>
              {peers.filter(p => p.connectionType === 'bluetooth').length === 0 ? (
                <div className="text-[10px] opacity-40 p-4 border border-[#004400] bg-black/20 lowercase">no active bluetooth nodes found. {isRealMode ? '(scanning...)' : ''}</div>
              ) : (
                <div className="space-y-2">
                  {peers.filter(p => p.connectionType === 'bluetooth').map(node => (
                    <div key={node.id} className="border border-[#00ff41]/30 p-3 md:p-2 bg-[#050505] flex items-center justify-between gap-2">
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <div className="w-2 h-2 bg-[#00ff41] rounded-full flex-shrink-0 animate-pulse"></div>
                        <p className="font-bold text-[#00ff41] text-sm md:text-xs truncate">{node.handle}</p>
                      </div>
                      <button
                        onClick={() => onUserSelect({
                          id: node.id,
                          name: node.name,
                          handle: node.handle,
                          avatar: `https://picsum.photos/seed/${node.handle}/200`,
                          mood: 'Bluetooth Node',
                          moodEmoji: '📡',
                          reputation: 750,
                          distance: 0,
                          status: 'Online'
                        })}
                        className="text-[8px] bg-[#00ff41] text-black px-3 py-2 md:px-2 md:py-1 rounded font-bold uppercase min-h-[36px] md:min-h-0 whitespace-nowrap hover:bg-[#00ff41]/80"
                      >
                        chat
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* WiFi */}
            <div>
              <h3 className="text-sm font-bold text-cyan-400 mb-3 uppercase tracking-wider">WIFI_P2P_PEERS</h3>
              {peers.filter(p => p.connectionType === 'wifi').length === 0 ? (
                <div className="text-[10px] opacity-40 p-4 border border-cyan-400/20 bg-cyan-400/5 lowercase">no active wifi p2p peers found.</div>
              ) : (
                <div className="space-y-2">
                  {peers.filter(p => p.connectionType === 'wifi').map(peer => (
                    <div key={peer.id} className="border border-cyan-400/30 p-3 md:p-2 bg-[#050505] flex items-center justify-between gap-2">
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <div className={`w-2 h-2 ${peer.isConnected ? 'bg-cyan-400' : 'bg-cyan-600/50'} rounded-full flex-shrink-0`}></div>
                        <p className="font-bold text-cyan-400 text-sm md:text-xs truncate">{peer.handle}</p>
                      </div>
                      <button
                        onClick={() => onUserSelect({
                          id: peer.id,
                          name: peer.name,
                          handle: peer.handle,
                          avatar: `https://picsum.photos/seed/${peer.handle}/200`,
                          mood: 'WiFi P2P Node',
                          moodEmoji: '📶',
                          reputation: 800,
                          distance: 0,
                          status: peer.isConnected ? 'Online' : 'Away'
                        })}
                        className="text-[8px] bg-cyan-400 text-black px-3 py-2 md:px-2 md:py-1 rounded font-bold uppercase min-h-[36px] md:min-h-0 whitespace-nowrap hover:bg-cyan-400/80"
                      >
                        chat
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Real (WebRTC) */}
            <div>
              <h3 className="text-sm font-bold text-red-500 mb-3 uppercase tracking-wider">REAL_P2P_PEERS</h3>
              {peers.filter(p => p.connectionType === 'webrtc').length === 0 ? (
                <div className="text-[10px] opacity-40 p-4 border border-red-500/20 bg-red-500/5 lowercase">no active webRTC peers found.</div>
              ) : (
                <div className="space-y-2">
                  {peers.filter(p => p.connectionType === 'webrtc').map(peer => (
                    <div key={peer.id} className="border border-red-500/30 p-3 md:p-2 bg-[#050505] flex items-center justify-between gap-2">
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <div className={`w-2 h-2 ${peer.isConnected ? 'bg-red-500' : 'bg-red-600/50'} rounded-full flex-shrink-0`}></div>
                        <p className="font-bold text-red-500 text-sm md:text-xs truncate">{peer.handle}</p>
                      </div>
                      <button onClick={() => onUserSelect({
                        id: peer.id,
                        name: peer.name,
                        handle: peer.handle,
                        avatar: `https://picsum.photos/seed/${peer.handle}/200`,
                        mood: 'WebRTC Peer',
                        moodEmoji: '🔴',
                        reputation: 950,
                        distance: 0,
                        status: peer.isConnected ? 'Online' : 'Away'
                      })} className="text-[8px] bg-red-500 text-white px-3 py-2 md:px-2 md:py-1 rounded font-bold uppercase min-h-[36px] md:min-h-0 whitespace-nowrap">chat</button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Radar (Nostr/Broadcast) */}
            <div>
              <h3 className="text-sm font-bold text-green-400 mb-3 uppercase tracking-wider">RADAR_PEERS</h3>
              {peers.filter(p => p.connectionType === 'nostr' || p.connectionType === 'broadcast').length === 0 ? (
                <div className="text-[10px] opacity-40 p-4 border border-green-400/20 bg-green-400/5 lowercase">no active radar peers found.</div>
              ) : (
                <div className="space-y-2">
                  {peers.filter(p => p.connectionType === 'nostr' || p.connectionType === 'broadcast').map(peer => (
                    <div key={peer.id} className="border border-green-400/30 p-3 md:p-2 bg-[#050505] flex items-center justify-between gap-2">
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <div className={`w-2 h-2 ${peer.isConnected ? 'bg-green-400' : 'bg-green-600/50'} rounded-full flex-shrink-0`}></div>
                        <p className="font-bold text-green-400 text-sm md:text-xs truncate">{peer.handle}</p>
                      </div>
                      <button onClick={() => onUserSelect({
                        id: peer.id,
                        name: peer.name,
                        handle: peer.handle,
                        avatar: `https://picsum.photos/seed/${peer.handle}/200`,
                        mood: 'Radar Peer',
                        moodEmoji: '📡',
                        reputation: 850,
                        distance: 0,
                        status: peer.isConnected ? 'Online' : 'Away'
                      })} className="text-[8px] bg-green-400 text-black px-3 py-2 md:px-2 md:py-1 rounded font-bold uppercase min-h-[36px] md:min-h-0 whitespace-nowrap">chat</button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Bottom Status Bar - As per image */}
      <div className="mt-4 grid grid-cols-2 gap-4">
        <div className="border border-[#004400] p-4 bg-[#00110011]">
          <p className="text-[8px] font-bold opacity-30 uppercase tracking-widest mb-2">SIGNAL FIDELITY</p>
          <div className="w-full bg-black border border-[#004400] h-2 rounded-full overflow-hidden">
            <div className="bg-[#00ff41] h-full shadow-[0_0_10px_#00ff41]" style={{ width: `${signalStrength}%` }}></div>
          </div>
        </div>
        <div className="border border-[#004400] p-4 bg-[#00110011]">
          <p className="text-[8px] font-bold opacity-30 uppercase tracking-widest mb-2">TOTAL_PEERS</p>
          <p className="text-sm font-bold text-white uppercase">{getVisibleNodes().length} discovered</p>
        </div>
      </div>

      {selectedPeer && (
        <div className="absolute inset-0 bg-black bg-opacity-95 z-50 flex items-center justify-center p-4">
          <div className={`bg-[#0a0a0a] border ${selectedPeer.connectionType === 'bluetooth' ? 'border-green-500' :
            selectedPeer.connectionType === 'wifi' ? 'border-cyan-400' :
              'border-red-500'
            } rounded-lg p-6 max-w-md w-full shadow-[0_0_50px_rgba(0,0,0,0.5)]`}>
            <div className="flex items-center gap-4 mb-6">
              <div className={`w-16 h-16 border ${selectedPeer.connectionType === 'bluetooth' ? 'border-green-500' :
                selectedPeer.connectionType === 'wifi' ? 'border-cyan-400' :
                  'border-red-500'
                } rounded-full overflow-hidden`}>
                <img src={`https://picsum.photos/seed/${selectedPeer.handle}/200`} className="w-full h-full object-cover grayscale" alt="" />
              </div>
              <div className="flex-1">
                <h3 className={`text-lg font-bold ${selectedPeer.connectionType === 'bluetooth' ? 'text-green-500' :
                  selectedPeer.connectionType === 'wifi' ? 'text-cyan-400' :
                    'text-red-400'
                  }`}>{selectedPeer.handle}</h3>
                <p className="text-sm opacity-60 lowercase">{selectedPeer.name || selectedPeer.handle}</p>
                <div className="flex items-center gap-2 mt-1">
                  <span className={`px-2 py-1 text-xs rounded ${!selectedPeer.isConnected ? 'bg-red-500/20 text-red-400' : 'bg-green-500/20 text-green-400'
                    }`}>
                    {selectedPeer.isConnected ? 'Connected' : 'Available'}
                  </span>
                  <span className="text-xs opacity-50 uppercase">{selectedPeer.connectionType}</span>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <button
                onClick={() => {
                  // Direct connection logic if needed, or just standard select
                  onUserSelect({
                    id: selectedPeer.id,
                    name: selectedPeer.name || selectedPeer.handle,
                    handle: selectedPeer.handle,
                    avatar: `https://picsum.photos/seed/${selectedPeer.handle}/200`,
                    mood: `Connected via ${selectedPeer.connectionType}`,
                    moodEmoji: '📡',
                    reputation: 800,
                    distance: 0,
                    status: 'Online'
                  });
                  setSelectedPeer(null);
                }}
                className={`w-full font-bold py-3 px-4 rounded transition-colors uppercase text-[10px] tracking-widest ${selectedPeer.connectionType === 'bluetooth' ? 'bg-green-500 text-black' :
                  selectedPeer.connectionType === 'wifi' ? 'bg-cyan-500 text-black' :
                    'bg-red-500 text-white'
                  }`}
              >
                Start Chat
              </button>

              <button
                onClick={() => setSelectedPeer(null)}
                className="w-full bg-gray-700 hover:bg-gray-600 text-white font-bold py-3 px-4 rounded transition-colors uppercase text-[10px] tracking-widest"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MapView;
