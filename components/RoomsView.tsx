
import React, { useState } from 'react';
import { Chat } from '../types';

interface Room {
  id: string;
  name: string;
  pop: number;
  desc: string;
  tags: string[];
}

interface RoomsViewProps {
  onJoinRoom: (roomId: string) => void;
}

const RoomsView: React.FC<RoomsViewProps> = ({ onJoinRoom }) => {
  const [confirmingRoom, setConfirmingRoom] = useState<Room | null>(null);

  const publicRooms: Room[] = [
    { id: 'room-gen', name: 'General Lobby', pop: 1240, desc: 'The main entrance to the mesh.', tags: ['chat', 'social'] },
    { id: 'room-trade', name: 'Trading Floor', pop: 452, desc: 'Swap skins and stickers for XC.', tags: ['trade', 'moola'] },
    { id: 'room-dev', name: 'Dev Void', pop: 89, desc: 'Talk tech, loops, and hardware.', tags: ['tech', 'hacking'] },
    { id: 'room-flirt', name: 'The Pink Room', pop: 2105, desc: 'Local geohash matchmaking.', tags: ['dating', 'local'] },
    { id: 'room-music', name: 'Audio Node', pop: 156, desc: 'Share signal frequencies.', tags: ['music', 'beats'] },
  ];

  const handleConnectRequest = (room: Room) => {
    setConfirmingRoom(room);
  };

  const handleConfirmJoin = () => {
    if (confirmingRoom) {
      onJoinRoom(confirmingRoom.id);
      setConfirmingRoom(null);
    }
  };

  return (
    <div className="flex-1 flex flex-col p-6 overflow-y-auto bg-black text-current no-scrollbar relative">
      <div className="flex justify-between items-start mb-10 border-b border-current border-opacity-20 pb-4">
        <div>
          <h2 className="text-lg font-bold uppercase tracking-tighter glow-text">room_protocol.bin</h2>
          <p className="text-[10px] font-bold opacity-50 uppercase tracking-[0.2em] mt-2 text-white/30">public_mesh_nodes</p>
        </div>
      </div>

      <div className="space-y-4 max-w-3xl mx-auto w-full">
        {publicRooms.map((room) => (
          <div key={room.id} className="border border-current border-opacity-10 bg-[#050505] p-5 group hover:bg-white/[0.03] hover:border-white/40 transition-all flex flex-col md:flex-row justify-between items-start md:items-center gap-4 cursor-pointer" onClick={() => handleConnectRequest(room)}>
            <div className="flex-1">
              <div className="flex items-center gap-3">
                <h3 className="text-lg font-bold uppercase tracking-tight text-white group-hover:text-white transition-colors">#{room.name.toLowerCase().replace(' ', '_')}</h3>
                <span className="text-[9px] border border-current border-opacity-30 px-2 py-0.5 opacity-50 animate-pulse text-white/60 font-bold">
                  {room.pop} ONLINE
                </span>
              </div>
              <p className="text-xs opacity-40 mt-1 italic text-white/50 group-hover:opacity-80 transition-opacity">&gt; {room.desc}</p>
              <div className="flex gap-2 mt-3">
                {room.tags.map(tag => (
                  <span key={tag} className="text-[8px] font-bold opacity-30 uppercase tracking-widest border border-current border-opacity-10 px-1 text-white/30">[{tag}]</span>
                ))}
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
        <p className="text-[10px] font-bold uppercase tracking-[0.4em] text-white/40">scanning_for_private_nodes...</p>
      </div>

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
                <p className="text-xl font-black uppercase tracking-tighter text-white glow-text mb-2">
                  #{confirmingRoom.name.toLowerCase().replace(' ', '_')}
                </p>
                <p className="text-[10px] opacity-40 uppercase tracking-widest">
                  active_peers: {confirmingRoom.pop}
                </p>
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
