import React, { useState, useEffect } from 'react';
import { Chat } from '../types';
import { nostrService } from '../services/nostrService';
import { hybridMesh } from '../services/hybridMesh';

interface ChatListProps {
  chats: Chat[];
  activeChatId: string | null;
  onChatSelect: (chatId: string) => void;
  onInviteNode: () => void;
  className?: string;
}

const ChatList: React.FC<ChatListProps> = ({ chats, activeChatId, onChatSelect, onInviteNode, className = "" }) => {
  const [meshStatus, setMeshStatus] = useState({ connected: false, peerCount: 0 });
  const [typingPeers, setTypingPeers] = useState<Set<string>>(new Set());

  const sanitizePreview = (text: string): string => {
    const value = (text || '').trim();
    if (
      value.startsWith('xitchat-broadcast-v1-') ||
      value.startsWith('xitchat-wifi:') ||
      value.startsWith('xitchat-economy-sync:')
    ) {
      return 'signal_packet_hidden';
    }
    return text;
  };

  useEffect(() => {
    const updateMeshStatus = () => {
      const info = hybridMesh.getConnectionInfo();
      // ── FIX #1: use isRealConnection + peerCount — isConnected doesn't exist on this shape ──
      setMeshStatus({
        connected: !!(info.isRealConnection || info.peerCount > 0),
        peerCount: info.peerCount
      });
    };

    updateMeshStatus();
    const unsubscribeMesh = hybridMesh.subscribe('peersUpdated', updateMeshStatus);

    // ── FIX #3: listen to messageReceived and filter for type === 'typing' ──
    // hybridMesh emits messageReceived with message.type === 'typing', not a 'typing' event
    const unsubscribeTyping = hybridMesh.subscribe('messageReceived', (data: any) => {
      if (data?.type !== 'typing') return;
      const chatId = data.chatId || data.from;
      if (!chatId) return;
      if (data.isTyping) {
        setTypingPeers(prev => new Set(prev).add(chatId));
      } else {
        setTypingPeers(prev => {
          const next = new Set(prev);
          next.delete(chatId);
          return next;
        });
      }
    });

    return () => {
      unsubscribeMesh();
      unsubscribeTyping();
    };
  }, []);

  // ── FIX #2: hoist nostrPeers lookup outside map — avoids O(n) alloc per chat per render ──
  const nostrPeers = nostrService.getPeers();

  return (
    <div className={`w-full md:w-80 h-full overflow-hidden border-r border-[#004400] flex flex-col bg-black pt-safe ${className}`}>
      <div className="p-4 md:p-6 border-b border-[#004400]">
        <div className="flex items-center justify-between mb-1 gap-2">
          <h1 className="text-xl md:text-2xl font-black uppercase tracking-tighter glow-text">
            xitchat
          </h1>
          <span className={`text-[10px] uppercase font-bold transition-colors ${meshStatus.connected ? 'text-[#00ff41]' : 'text-red-500'}`}>
            MESH: {meshStatus.connected ? `${meshStatus.peerCount} NODES` : 'OFFLINE'}
          </span>
        </div>
        <p className="text-[9px] text-[#006600] italic leading-tight mt-1">
          decentralized geohash messaging
        </p>
      </div>

      <div className="flex-1 overflow-y-auto py-4 no-scrollbar">
        <div className="text-[10px] font-bold text-[#004400] px-4 mb-4 flex items-center justify-between uppercase tracking-widest">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <i className="fa-solid fa-network-wired text-[8px] flex-shrink-0"></i>
            <span className="truncate">active_nodes</span>
          </div>
          <button
            onClick={onInviteNode}
            className="text-[9px] border border-current border-opacity-20 px-2 py-1 hover:border-opacity-100 transition-colors flex-shrink-0 whitespace-nowrap gap-1"
            title="Invite peer"
          >
            + SCAN
          </button>
        </div>

        {chats.map((chat) => {
          // ── FIX #2: use hoisted nostrPeers instead of calling getPeers() per chat ──
          const isOnline =
            chat.participant.status === 'Online' ||
            nostrPeers.some(p =>
              (p.id === chat.participant.id || p.publicKey === chat.participant.id) &&
              p.isConnected
            );
          const isTyping = typingPeers.has(chat.id);

          return (
            <button
              key={chat.id}
              onClick={() => onChatSelect(chat.id)}
              className={`w-full px-4 py-4 flex items-start gap-4 transition-all border-b border-transparent group hover:bg-white/[0.03] ${
                activeChatId === chat.id ? 'bg-white/[0.05] border-[#00ff4122]' : ''
              }`}
            >
              <div className="relative shrink-0">
                <div className={`w-3 h-3 rounded-sm transition-all duration-500 ${
                  isOnline ? 'bg-[#00ff41] shadow-[0_0_8px_#00ff41]' : 'bg-[#004400]'
                }`}></div>
                {chat.participant.moodEmoji && (
                  <div className="absolute -top-1 -right-2 text-[10px] opacity-80">
                    {chat.participant.moodEmoji}
                  </div>
                )}
              </div>
              <div className="flex-1 text-left min-w-0">
                <div className="flex justify-between items-baseline gap-2">
                  <span className={`text-sm font-bold truncate group-hover:text-white transition-colors flex items-center gap-1 ${
                    chat.participant.id === 'xit-bot' ? 'text-cyan-400' : 'text-orange-400'
                  }`}>
                    {chat.isEncrypted && <i className="fa-solid fa-lock text-[10px] text-[#00ff41]"></i>}
                    &lt;{chat.participant.handle}&gt;
                  </span>
                  <div className="flex items-center gap-1">
                    {chat.unreadCount > 0 && (
                      <span className="text-[10px] animate-pulse text-[#00ff41] shrink-0">
                        [{chat.unreadCount}]
                      </span>
                    )}
                    {isTyping && <span className="text-[8px] text-[#00ff41] animate-bounce">...</span>}
                  </div>
                </div>
                <p className={`text-[11px] truncate mt-0.5 transition-colors ${
                  isTyping ? 'text-[#00ff41] italic' : 'text-[#006600] group-hover:text-[#00aa22]'
                }`}>
                  &gt; {isTyping ? 'typing...' : sanitizePreview(chat.lastMessage)}
                </p>
              </div>
            </button>
          );
        })}
      </div>

      <div className="p-4 border-t border-[#004400] hidden md:block">
        <div className="flex gap-2 text-[8px] font-mono opacity-20 uppercase tracking-widest">
          <span>v1.0.1_mesh_protocol</span>
        </div>
      </div>
    </div>
  );
};

export default ChatList;
