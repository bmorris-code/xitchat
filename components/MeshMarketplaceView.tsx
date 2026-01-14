import React, { useState, useEffect } from 'react';
import { meshMarketplace, MeshListing, TradeRequest } from '../services/meshMarketplace';
import { bluetoothMesh, MeshNode } from '../services/bluetoothMesh';
import { wifiP2P, WiFiPeer } from '../services/wifiP2P';

interface MeshMarketplaceViewProps {
  onBack: () => void;
  onContact: (handle: string) => void;
}

const MeshMarketplaceView: React.FC<MeshMarketplaceViewProps> = ({ onBack, onContact }) => {
  const [filter, setFilter] = useState<'ALL' | 'HAVE' | 'WANT' | 'SERVICE' | 'EVENT' | 'NEARBY'>('ALL');
  const [showPostModal, setShowPostModal] = useState(false);
  const [listings, setListings] = useState<MeshListing[]>([]);
  const [nearbyNodes, setNearbyNodes] = useState<Array<MeshNode & { hasListings: boolean }>>([]);
  const [wifiPeers, setWifiPeers] = useState<WiFiPeer[]>([]);
  const [tradeRequests, setTradeRequests] = useState<TradeRequest[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [isWifiDiscovering, setIsWifiDiscovering] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  
  // Form states
  const [newListing, setNewListing] = useState({
    title: '',
    category: 'HAVE' as const,
    price: '',
    description: '',
    location: ''
  });

  useEffect(() => {
    initializeMeshMarketplace();
    initializeWiFiP2P();
  }, []);

  const initializeWiFiP2P = async () => {
    try {
      const initialized = await wifiP2P.initialize();
      if (initialized) {
        // Subscribe to WiFi P2P events
        wifiP2P.on('peerFound', (peer: WiFiPeer) => {
          setWifiPeers(prev => [...prev, peer]);
        });

        wifiP2P.on('peerLost', (peer: WiFiPeer) => {
          setWifiPeers(prev => prev.filter(p => p.id !== peer.id));
        });

        wifiP2P.on('peerConnected', (peer: WiFiPeer) => {
          console.log(`✅ Connected to ${peer.name} via WiFi P2P`);
        });

        wifiP2P.on('messageReceived', (message) => {
          console.log('📨 WiFi P2P message:', message);
        });

        wifiP2P.on('discoveryStarted', () => {
          setIsWifiDiscovering(true);
        });

        wifiP2P.on('discoveryStopped', () => {
          setIsWifiDiscovering(false);
        });
      }
    } catch (error) {
      console.error('WiFi P2P initialization failed:', error);
    }
  };

  const initializeMeshMarketplace = async () => {
    try {
      setIsLoading(true);
      const connected = await meshMarketplace.initialize();
      setIsConnected(connected);
      
      // Subscribe to updates
      const unsubscribeListings = meshMarketplace.subscribe('listings', (updatedListings) => {
        setListings(updatedListings);
      });
      
      const unsubscribeNodes = meshMarketplace.subscribe('nearbyNodes', (nodes) => {
        setNearbyNodes(nodes);
      });
      
      const unsubscribeRequests = meshMarketplace.subscribe('tradeRequests', (requests) => {
        setTradeRequests(requests);
      });

      setIsLoading(false);
      
      return () => {
        unsubscribeListings();
        unsubscribeNodes();
        unsubscribeRequests();
      };
    } catch (error) {
      console.error('Failed to initialize mesh marketplace:', error);
      setIsLoading(false);
    }
  };

  const handleCreateListing = async () => {
    if (!newListing.title.trim() || !newListing.description.trim()) return;

    try {
      await meshMarketplace.broadcastListing({
        id: `listing_${Date.now()}`,
        title: newListing.title,
        price: newListing.price || '0 XC',
        senderHandle: '@symbolic',
        timestamp: Date.now(),
        category: newListing.category,
        description: newListing.description,
        location: newListing.location || 'Sector 428F'
      });

      setNewListing({
        title: '',
        category: 'HAVE',
        price: '',
        description: '',
        location: ''
      });
      setShowPostModal(false);
    } catch (error) {
      console.error('Failed to create listing:', error);
      alert('Failed to broadcast listing to mesh network');
    }
  };

  const handleTradeRequest = async (listing: MeshListing) => {
    const message = prompt(`Message to ${listing.nodeHandle}:`, 'I\'m interested in your listing. Is it still available?');
    if (!message) return;

    try {
      await meshMarketplace.sendTradeRequest(listing.id, message);
      alert('Trade request sent via mesh network!');
    } catch (error) {
      console.error('Failed to send trade request:', error);
      alert('Failed to send trade request');
    }
  };

  const handleTradeResponse = async (requestId: string, accept: boolean) => {
    try {
      await meshMarketplace.respondToTradeRequest(requestId, accept);
      alert(`Trade request ${accept ? 'accepted' : 'declined'}!`);
    } catch (error) {
      console.error('Failed to respond to trade request:', error);
    }
  };

  // WiFi P2P Functions
  const startWiFiDiscovery = () => {
    wifiP2P.startDiscovery();
  };

  const stopWiFiDiscovery = () => {
    wifiP2P.stopDiscovery();
  };

  const connectToWiFiPeer = async (peerId: string) => {
    try {
      const success = await wifiP2P.connectToPeer(peerId);
      if (success) {
        alert('Connected to peer via WiFi P2P!');
      }
    } catch (error) {
      console.error('Failed to connect to peer:', error);
      alert('Failed to connect to peer');
    }
  };

  const sendWiFiMessage = (peerId: string, message: string) => {
    const success = wifiP2P.sendMessage(peerId, message);
    if (success) {
      console.log('Message sent via WiFi P2P');
    }
  };

  const filteredListings = listings.filter(l => {
    if (filter === 'NEARBY') return l.isProximity;
    return filter === 'ALL' || l.category === filter;
  });

  const getDistanceColor = (distance?: number) => {
    if (!distance) return 'text-gray-400';
    if (distance < 10) return 'text-green-400';
    if (distance < 30) return 'text-yellow-400';
    return 'text-red-400';
  };

  return (
    <div className="flex-1 p-6 overflow-y-auto bg-black text-current font-mono no-scrollbar">
      {/* Header */}
      <div className="flex items-center justify-between mb-8 border-b border-current pb-4">
        <div className="flex items-center gap-4">
          <button onClick={onBack} className="terminal-btn px-2 py-0 h-8 text-[10px] uppercase">back_to_hub</button>
          <div>
            <h2 className="text-lg font-bold uppercase tracking-tighter glow-text">mesh_market.bbs</h2>
            <p className="text-[10px] font-bold opacity-50 uppercase tracking-widest text-white/30">
              {isConnected ? 'bluetooth_mesh_active' : isWifiDiscovering ? 'wifi_p2p_active' : 'mesh_offline'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right">
            <p className="text-[8px] font-bold opacity-50 uppercase tracking-widest text-white/40">nearby_nodes</p>
            <p className="text-xl font-bold glow-text text-white">{nearbyNodes.length + wifiPeers.length}</p>
          </div>
          <button 
            onClick={isWifiDiscovering ? stopWiFiDiscovery : startWiFiDiscovery}
            className={`terminal-btn px-2 py-1 text-[8px] uppercase font-bold ${
              isWifiDiscovering ? 'bg-red-500 text-black' : 'active'
            }`}
          >
            {isWifiDiscovering ? 'stop_scan' : 'wifi_scan'}
          </button>
          <button onClick={() => setShowPostModal(true)} className="terminal-btn active px-2 py-1 text-[8px] uppercase font-bold">
            + broadcast
          </button>
        </div>
      </div>

      {/* Connection Status */}
      {!isConnected && (
        <div className="mb-6 p-4 border border-red-500 bg-red-500/10 text-red-400 text-xs">
          <i className="fa-solid fa-triangle-exclamation mr-2"></i>
          Bluetooth mesh not connected. Enable Bluetooth to use proximity trading.
        </div>
      )}

      {/* Nearby Nodes */}
      {nearbyNodes.length > 0 && (
        <div className="mb-8">
          <h3 className="text-lg font-bold uppercase mb-4 text-white">nearby_traders</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            {nearbyNodes.map(node => (
              <div key={node.id} className="p-3 border border-current border-opacity-20 bg-[#050505]">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-white">{node.handle}</span>
                  {node.hasListings && (
                    <span className="text-[8px] bg-green-500 text-black px-1">active</span>
                  )}
                </div>
                <p className={`text-[8px] ${getDistanceColor(node.distance)}`}>
                  {node.distance?.toFixed(1)}m away
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* WiFi P2P Peers */}
      {wifiPeers.length > 0 && (
        <div className="mb-8">
          <h3 className="text-lg font-bold uppercase mb-4 text-cyan-400">wifi_p2p_peers</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {wifiPeers.map(peer => (
              <div key={peer.id} className="p-3 border border-cyan-500/30 bg-[#050505]">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-xs font-bold text-cyan-400">{peer.name}</span>
                    <p className="text-[8px] opacity-60">{peer.handle}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {peer.isConnected ? (
                      <span className="text-[8px] bg-green-500 text-black px-1">connected</span>
                    ) : (
                      <button 
                        onClick={() => connectToWiFiPeer(peer.id)}
                        className="terminal-btn active px-2 py-1 text-[8px] uppercase"
                      >
                        connect
                      </button>
                    )}
                    <span className="text-[8px] text-cyan-400">wifi</span>
                  </div>
                </div>
                {peer.isConnected && (
                  <div className="mt-2 pt-2 border-t border-current border-opacity-20">
                    <input 
                      type="text" 
                      placeholder="send message..."
                      className="w-full bg-black border border-current border-opacity-30 px-2 py-1 text-[10px] font-mono"
                      onKeyPress={(e) => {
                        if (e.key === 'Enter') {
                          sendWiFiMessage(peer.id, e.currentTarget.value);
                          e.currentTarget.value = '';
                        }
                      }}
                    />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Trade Requests */}
      {tradeRequests.length > 0 && (
        <div className="mb-8">
          <h3 className="text-lg font-bold uppercase mb-4 text-white">trade_requests</h3>
          <div className="space-y-2">
            {tradeRequests.map(request => (
              <div key={request.id} className="p-3 border border-current border-opacity-20 bg-[#050505]">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-sm font-bold text-white">{request.fromNode}</p>
                    <p className="text-xs opacity-60">{request.message}</p>
                  </div>
                  <div className="flex gap-2">
                    <button 
                      onClick={() => handleTradeResponse(request.id, false)}
                      className="terminal-btn px-2 py-1 text-[8px] uppercase"
                    >
                      decline
                    </button>
                    <button 
                      onClick={() => handleTradeResponse(request.id, true)}
                      className="terminal-btn active px-2 py-1 text-[8px] uppercase"
                    >
                      accept
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex gap-2 mb-8 overflow-x-auto pb-2 no-scrollbar">
        {['ALL', 'NEARBY', 'HAVE', 'WANT', 'SERVICE', 'EVENT'].map(cat => (
          <button 
            key={cat} 
            onClick={() => setFilter(cat as any)}
            className={`terminal-btn px-4 h-8 text-[9px] uppercase tracking-widest transition-all ${
              filter === cat ? 'active' : 'opacity-40 hover:opacity-100'
            }`}
          >
            {cat === 'NEARBY' && <i className="fa-solid fa-bluetooth-b mr-2"></i>}
            {cat}
          </button>
        ))}
      </div>

      {/* Listings */}
      {isLoading ? (
        <div className="py-20 flex flex-col items-center justify-center opacity-30 gap-4">
          <i className="fa-solid fa-spinner animate-spin text-4xl"></i>
          <p className="text-xs font-bold uppercase tracking-widest">connecting_to_mesh...</p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredListings.map(item => (
            <div key={item.id} className={`border border-current border-opacity-10 bg-[#050505] p-5 group hover:border-white/40 transition-all flex flex-col gap-3 relative ${
              item.isProximity ? 'border-green-500/30 bg-green-500/5' : ''
            }`}>
              {/* Proximity Indicator */}
              {item.isProximity && (
                <div className="absolute top-2 right-2 px-2 py-1 bg-green-500 text-black text-[8px] font-black uppercase tracking-widest">
                  <i className="fa-solid fa-bluetooth-b mr-1"></i>
                  {item.distance?.toFixed(1)}m
                </div>
              )}
              
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <span className={`text-[8px] font-bold px-2 py-0.5 border ${
                      item.category === 'HAVE' ? 'border-green-500 text-green-500' : 
                      item.category === 'WANT' ? 'border-amber-500 text-amber-500' : 
                      item.category === 'EVENT' ? 'border-white text-white' : 'border-cyan-500 text-cyan-500'
                    }`}>
                      {item.category}
                    </span>
                    {item.nodeHandle !== '@symbolic' && (
                      <span className="text-[8px] opacity-60">
                        from {item.nodeHandle}
                      </span>
                    )}
                  </div>
                  <h3 className="text-lg font-bold uppercase mt-2 text-white group-hover:glow-text transition-all">
                    {item.title}
                  </h3>
                  <p className="text-[10px] opacity-40 uppercase tracking-widest mt-1">
                    {item.location ? `loc: ${item.location}` : 'no_location'}
                  </p>
                </div>
                <div className="text-right ml-4">
                  <p className="text-lg font-black glow-text text-white">{item.price}</p>
                  <p className="text-[8px] opacity-30 uppercase mt-1">val_units</p>
                </div>
              </div>
              
              <p className="text-xs opacity-60 leading-relaxed text-white/70 italic">
                &gt; {item.description}
              </p>
              
              <div className="flex gap-4 mt-2">
                {item.nodeHandle !== '@symbolic' ? (
                  <>
                    <button 
                      onClick={() => handleTradeRequest(item)}
                      className="terminal-btn active flex-1 py-1 text-[10px] uppercase font-bold"
                    >
                      trade_request
                    </button>
                    <button 
                      onClick={() => onContact(item.nodeHandle)}
                      className="terminal-btn flex-1 py-1 text-[10px] uppercase font-bold"
                    >
                      contact_node
                    </button>
                  </>
                ) : (
                  <div className="text-[8px] opacity-40 text-center w-full">your_listing</div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create Listing Modal */}
      {showPostModal && (
        <div className="fixed inset-0 z-[100] bg-black/95 flex items-center justify-center p-6 animate-in fade-in">
          <div className="max-w-2xl w-full border-2 border-current bg-[#050505] p-8 shadow-[0_0_50px_currentColor] max-h-[90vh] overflow-y-auto">
            <h3 className="text-xl font-bold uppercase tracking-widest mb-6 glow-text text-center">mesh_broadcast.exe</h3>
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <input 
                  value={newListing.title}
                  onChange={(e) => setNewListing(prev => ({ ...prev, title: e.target.value }))}
                  className="bg-black border border-current p-3 text-xs text-white placeholder-white/20" 
                  placeholder="listing_title" 
                />
                <select 
                  value={newListing.category}
                  onChange={(e) => setNewListing(prev => ({ ...prev, category: e.target.value as any }))}
                  className="bg-black border border-current p-3 text-xs text-white"
                >
                  <option value="HAVE">HAVE (Trade Something)</option>
                  <option value="WANT">WANT (Looking For)</option>
                  <option value="SERVICE">SERVICE (Offer Help)</option>
                  <option value="EVENT">EVENT (Local Meetup)</option>
                </select>
              </div>
              
              <input 
                value={newListing.price}
                onChange={(e) => setNewListing(prev => ({ ...prev, price: e.target.value }))}
                className="w-full bg-black border border-current p-3 text-xs text-white placeholder-white/20" 
                placeholder="price / xc_units (or 'Negotiable' / 'Free')" 
              />
              
              <input 
                value={newListing.location}
                onChange={(e) => setNewListing(prev => ({ ...prev, location: e.target.value }))}
                className="w-full bg-black border border-current p-3 text-xs text-white placeholder-white/20" 
                placeholder="location (optional)" 
              />
              
              <textarea 
                value={newListing.description}
                onChange={(e) => setNewListing(prev => ({ ...prev, description: e.target.value }))}
                className="w-full bg-black border border-current p-3 text-xs text-white min-h-[120px] placeholder-white/20" 
                placeholder="detailed_listing_description..." 
              />
              
              <div className="grid grid-cols-2 gap-4">
                <button 
                  onClick={() => setShowPostModal(false)} 
                  className="terminal-btn py-3 uppercase text-[10px]"
                >
                  abort
                </button>
                <button 
                  onClick={handleCreateListing}
                  disabled={!newListing.title.trim() || !newListing.description.trim()}
                  className="terminal-btn active py-3 uppercase text-[10px] disabled:opacity-20"
                >
                  broadcast_to_mesh
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MeshMarketplaceView;
