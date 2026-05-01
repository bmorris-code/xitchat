import React, { useState, useEffect } from 'react';
import { geohashChannels, GeohashChannel } from '../services/geohashChannels';
import { showToast } from './TerminalModal';

interface RoomsViewProps {
  onJoinRoom: (roomId: string) => void;
}

const RoomsView: React.FC<RoomsViewProps> = ({ onJoinRoom }) => {
  const [confirmingRoom, setConfirmingRoom] = useState<GeohashChannel | null>(null);
  const [nearbyRooms, setNearbyRooms] = useState<GeohashChannel[]>([]);
  const [isLocating, setIsLocating] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newRoomName, setNewRoomName] = useState('');
  const [newRoomDesc, setNewRoomDesc] = useState('');
  const [isPrivate, setIsPrivate] = useState(false);
  const [isTrading, setIsTrading] = useState(false);

  // Static global rooms that are always available
  const globalRooms: GeohashChannel[] = [
    {
      id: 'room-gen',
      geohash: 'global',
      name: 'General Lobby',
      participants: [],
      desc: 'The main entrance to the mesh. Say hi!',
      description: 'The main entrance to the mesh. Say hi!',
      tags: ['chat', 'social'],
      isPublic: true,
      requiresInvite: false,
      createdBy: 'system',
      createdAt: 0,
      lastActivity: Date.now(),
      messageCount: 0,
      isEncrypted: false
    } as any,
    {
      id: 'room-trade',
      geohash: 'global',
      name: 'Trading Floor',
      participants: [],
      desc: 'Swap skins and stickers for XC.',
      description: 'Swap skins and stickers for XC.',
      tags: ['trade', 'moola'],
      isPublic: true,
      requiresInvite: false,
      createdBy: 'system',
      createdAt: 0,
      lastActivity: Date.now(),
      messageCount: 0,
      isEncrypted: false
    } as any,
    {
      id: 'room-help',
      geohash: 'global',
      name: 'Help & Support',
      participants: [],
      desc: 'New to XitChat? Ask questions here!',
      description: 'New to XitChat? Ask questions here!',
      tags: ['help', 'support'],
      isPublic: true,
      requiresInvite: false,
      createdBy: 'system',
      createdAt: 0,
      lastActivity: Date.now(),
      messageCount: 0,
      isEncrypted: false
    } as any,
    {
      id: 'room-local',
      geohash: 'global',
      name: 'Local Chat',
      participants: [],
      desc: 'Connect with people nearby.',
      description: 'Connect with people nearby.',
      tags: ['local', 'nearby'],
      isPublic: true,
      requiresInvite: false,
      createdBy: 'system',
      createdAt: 0,
      lastActivity: Date.now(),
      messageCount: 0,
      isEncrypted: false
    } as any,
  ];

  useEffect(() => {
    
    // Initial load
    try {
      const rooms = geohashChannels.getNearbyChannels();
      setNearbyRooms(rooms);
    } catch (error) {
      console.error('[ROOMS] Failed to get nearby channels:', error);
      setNearbyRooms([]);
    }

    const location = geohashChannels.getCurrentLocation();
    if (location) {
      setIsLocating(false);
    }

    // Subscribe to real-time updates
    try {
      const unsubscribeNearby = geohashChannels.subscribe('nearbyChannelsUpdated', (rooms) => {
        setNearbyRooms(rooms);
      });

      const unsubscribeLocation = geohashChannels.subscribe('locationUpdated', (loc) => {
        setIsLocating(false);
      });

      return () => {
        unsubscribeNearby();
        unsubscribeLocation();
      };
    } catch (error) {
      console.error('[ROOMS] Failed to subscribe to updates:', error);
      return () => {};
    }
  }, []);

  const handleConnectRequest = (room: GeohashChannel) => {
    setConfirmingRoom(room);
  };

  const handleConfirmJoin = async () => {
    if (confirmingRoom) {
      try {
        await geohashChannels.joinChannel(confirmingRoom.id);
        onJoinRoom(confirmingRoom.id);
        setConfirmingRoom(null);
      } catch (error) {
        console.error('Failed to join room:', error);
        alert('Failed to join room. Please try again.');
      }
    }
  };

  const handleCreateRoom = async () => {
    if (!newRoomName.trim()) return;
    try {
      const roomId = await geohashChannels.createChannel(newRoomName, newRoomDesc, !isPrivate && !isTrading, isPrivate || isTrading, isTrading);
      onJoinRoom(roomId);
      setShowCreateModal(false);
      setNewRoomName('');
      setNewRoomDesc('');
      setIsPrivate(false);
      setIsTrading(false);
    } catch (error) {
      console.error('Failed to create room:', error);
      alert('Failed to create room.');
    }
  };

  // Combine global and nearby rooms, avoiding duplicates
  const allRooms = [...globalRooms];
  nearbyRooms.forEach(room => {
    if (!allRooms.find(r => r.id === room.id)) {
      allRooms.push(room);
    }
  });

  return (
    <div className="flex-1 flex flex-col p-4 sm:p-6 overflow-y-auto bg-black text-current no-scrollbar relative">
      <div className="flex justify-between items-start mb-10 border-b border-current border-opacity-20 pb-4">
        <div>
          <h2 className="text-lg font-bold uppercase tracking-tighter glow-text">room_protocol.bin</h2>
          <p className="text-[10px] font-bold opacity-50 uppercase tracking-[0.2em] mt-2 text-white/30">
            {isLocating ? 'scanning_geohash_sector...' : 'active_mesh_nodes_discovered'}
          </p>
        </div>
        <div className="flex items-center gap-4">
          <button
            onClick={() => setShowCreateModal(true)}
            className="terminal-btn active px-3 py-1 text-[10px] uppercase font-bold"
          >
            + create_room
          </button>
          {isLocating && (
            <div className="flex items-center gap-2 text-[10px] text-[#00ff41] animate-pulse">
              <i className="fa-solid fa-location-crosshairs"></i>
              <span>LOCATING...</span>
            </div>
          )}
        </div>
      </div>

      <div className="space-y-4 max-w-3xl mx-auto w-full">
        {allRooms.map((room) => (
          <div
            key={room.id}
            className="border border-current border-opacity-10 bg-[#050505] p-4 sm:p-5 group hover:bg-white/[0.03] hover:border-white/40 transition-all flex flex-col md:flex-row justify-between items-start md:items-center gap-4 cursor-pointer"
            onClick={() => handleConnectRequest(room)}
          >
            <div className="flex-1">
              <div className="flex items-center gap-3">
                <h3 className="text-lg font-bold uppercase tracking-tight text-white group-hover:text-white transition-colors flex items-center gap-2">
                  {room.isEncrypted && <i className="fa-solid fa-lock text-[10px] text-[#00ff41]"></i>}
                  #{room.name.toLowerCase().replace(/\s+/g, '_')}
                </h3>
                {room.geohash !== 'global' && (
                  <span className="text-[8px] bg-[#00ff41]/10 text-[#00ff41] border border-[#00ff41]/30 px-1.5 py-0.5 font-bold">
                    LOCAL AREA
                  </span>
                )}
                <span className="text-[9px] border border-current border-opacity-30 px-2 py-0.5 opacity-50 text-white/60 font-bold">
                  {room.messageCount || 0} PEERS
                </span>
              </div>
              <p className="text-xs opacity-40 mt-1 italic text-white/50 group-hover:opacity-80 transition-opacity">
                &gt; {room.description || room.desc}
              </p>
              <div className="flex gap-2 mt-3">
                {(room.tags || []).map(tag => (
                  <span key={tag} className="text-[8px] font-bold opacity-30 uppercase tracking-widest border border-current border-opacity-10 px-1 text-white/30">[{tag}]</span>
                ))}
                {room.geohash !== 'global' && (
                  <span className="text-[8px] font-bold opacity-30 uppercase tracking-widest border border-current border-opacity-10 px-1 text-white/30">
                    [{room.geohash}]
                  </span>
                )}
              </div>
            </div>
            <button
              onClick={(e) => { e.stopPropagation(); handleConnectRequest(room); }}
              className="terminal-btn active w-full md:w-32 py-2 font-bold uppercase text-[10px] tracking-widest"
            >
              connect_node
            </button>
          </div>
        ))}
      </div>

      <div className="mt-12 p-6 border border-current border-dashed opacity-10 text-center">
        <p className="text-[10px] font-bold uppercase tracking-[0.4em] text-white/40">
          {isLocating ? 'waiting_for_gps_lock...' : 'scanning_for_private_nodes...'}
        </p>
      </div>

      {/* Create Room Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-sm flex items-center justify-center p-6 animate-in fade-in">
          <div className="max-w-md w-full border-2 border-current bg-[#050505] p-8 shadow-[0_0_50px_currentColor]">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold uppercase tracking-widest glow-text">init_new_room.exe</h3>
              <button onClick={() => setShowCreateModal(false)} className="text-xl font-bold hover:text-white transition-colors">X</button>
            </div>

            <div className="space-y-6">
              <div>
                <label className="block text-[10px] font-bold opacity-30 uppercase tracking-widest mb-2">room_name</label>
                <input
                  type="text"
                  value={newRoomName}
                  onChange={(e) => setNewRoomName(e.target.value)}
                  placeholder="e.g. shadow_runners"
                  className="w-full bg-black border border-current border-opacity-30 p-3 text-xs font-mono text-white focus:outline-none focus:border-opacity-100"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold opacity-30 uppercase tracking-widest mb-2">description</label>
                <textarea
                  value={newRoomDesc}
                  onChange={(e) => setNewRoomDesc(e.target.value)}
                  placeholder="brief purpose of this node..."
                  className="w-full bg-black border border-current border-opacity-30 p-3 text-xs font-mono text-white focus:outline-none focus:border-opacity-100 min-h-[80px]"
                />
              </div>

              <div className="flex items-center gap-3 p-3 border border-current border-opacity-20 bg-black/40">
                <input
                  type="checkbox"
                  id="privacy-toggle"
                  checked={isPrivate}
                  onChange={(e) => setIsPrivate(e.target.checked)}
                  className="w-4 h-4 accent-[#00ff41]"
                />
                <label htmlFor="privacy-toggle" className="text-xs font-bold uppercase tracking-widest cursor-pointer flex items-center gap-2">
                  <i className="fa-solid fa-lock text-[10px] text-[#00ff41]"></i>
                  private_room (e2ee)
                </label>
              </div>

              <div className="flex items-center gap-3 p-3 border border-current border-opacity-20 bg-black/40">
                <input
                  type="checkbox"
                  id="trading-toggle"
                  checked={isTrading}
                  onChange={(e) => {
                    setIsTrading(e.target.checked);
                    if (e.target.checked) setIsPrivate(true);
                  }}
                  className="w-4 h-4 accent-cyan-400"
                />
                <label htmlFor="trading-toggle" className="text-xs font-bold uppercase tracking-widest cursor-pointer flex items-center gap-2">
                  <i className="fa-solid fa-handshake text-[10px] text-cyan-400"></i>
                  trading_channel (secure_trade)
                </label>
              </div>

              <div className="flex flex-col gap-3">
                <button
                  onClick={handleCreateRoom}
                  disabled={!newRoomName.trim()}
                  className="terminal-btn active w-full py-4 uppercase font-bold text-xs tracking-[0.3em] shadow-lg disabled:opacity-20"
                >
                  establish_uplink
                </button>
                <button
                  onClick={() => setShowCreateModal(false)}
                  className="terminal-btn w-full py-3 uppercase font-bold text-[10px] tracking-widest opacity-40 hover:opacity-100"
                >
                  cancel_init
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Dialog */}
      {confirmingRoom && (
        <div className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-sm flex items-center justify-center p-6 animate-in fade-in">
          <div className="max-w-md w-full border-2 border-current bg-[#050505] p-8 shadow-[0_0_50px_currentColor]">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold uppercase tracking-widest glow-text">handshake_init.exe</h3>
              <button onClick={() => setConfirmingRoom(null)} className="text-xl font-bold hover:text-white transition-colors">X</button>
            </div>

            <div className="space-y-6">
              <div className="text-center p-4 border border-current border-opacity-20 bg-black">
                <p className="text-xs font-mono text-white/80 leading-relaxed mb-4">
                  established request for uplink to:
                </p>
                <div className="flex items-center justify-center gap-2 mb-2">
                  {confirmingRoom.isEncrypted && <i className="fa-solid fa-lock text-sm text-[#00ff41]"></i>}
                  <p className="text-xl font-black uppercase tracking-tighter text-white glow-text">
                    #{confirmingRoom.name.toLowerCase().replace(/\s+/g, '_')}
                  </p>
                </div>
                <p className="text-[10px] opacity-40 uppercase tracking-widest">
                  sector_geohash: {confirmingRoom.geohash}
                </p>
                {confirmingRoom.isEncrypted && (
                  <p className="text-[8px] text-[#00ff41] font-bold uppercase tracking-widest mt-2">
                    [E2EE_ENCRYPTION_ACTIVE]
                  </p>
                )}
              </div>

              <div className="flex flex-col gap-3">
                <button
                  onClick={handleConfirmJoin}
                  className="terminal-btn active w-full py-4 uppercase font-bold text-xs tracking-[0.3em] shadow-lg"
                >
                  authorize_connection
                </button>
                <button
                  onClick={() => setConfirmingRoom(null)}
                  className="terminal-btn w-full py-3 uppercase font-bold text-[10px] tracking-widest opacity-40 hover:opacity-100"
                >
                  abort_uplink
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default RoomsView;
