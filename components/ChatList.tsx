
import React from 'react';
import { Chat } from '../types';

interface ChatListProps {
  chats: Chat[];
  activeChatId: string | null;
  onChatSelect: (chatId: string) => void;
  onInviteNode: () => void;
  className?: string;
}

const ChatList: React.FC<ChatListProps> = ({ chats, activeChatId, onChatSelect, onInviteNode, className = "" }) => {
  return (
    <div className={`w-full md:w-80 border-r border-[#004400] flex flex-col bg-black pt-safe ${className}`}>
      <div className="p-4 md:p-6 border-b border-[#004400]">
        <div className="flex items-center justify-between mb-1 gap-2">
          <h1 className="text-xl md:text-2xl font-black uppercase tracking-tighter glow-text">
            xitchat
          </h1>
          <span className="text-[10px] text-[#004400] uppercase font-bold">MESH: ACTIVE</span>
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
        
        {chats.map((chat) => (
          <button
            key={chat.id}
            onClick={() => onChatSelect(chat.id)}
            className={`w-full px-4 py-4 flex items-start gap-4 transition-all border-b border-transparent group hover:bg-white/[0.03] ${
              activeChatId === chat.id ? 'bg-white/[0.05] border-[#00ff4122]' : ''
            }`}
          >
            <div className="relative shrink-0">
              <div className={`w-3 h-3 rounded-sm ${
                chat.participant.status === 'Online' ? 'bg-[#00ff41]' : 'bg-[#004400]'
              } shadow-[0_0_5px_currentColor]`}></div>
              {chat.participant.moodEmoji && (
                <div className="absolute -top-1 -right-2 text-[10px] opacity-80">
                   {chat.participant.moodEmoji}
                </div>
              )}
            </div>
            <div className="flex-1 text-left min-w-0">
              <div className="flex justify-between items-baseline gap-2">
                <span className={`text-sm font-bold truncate group-hover:text-white transition-colors ${
                  chat.participant.id === 'xit-bot' ? 'text-cyan-400' : 'text-orange-400'
                }`}>
                  &lt;{chat.participant.handle}&gt;
                </span>
                {chat.unreadCount > 0 && <span className="text-[10px] animate-pulse text-[#00ff41] shrink-0">[!]</span>}
              </div>
              <p className="text-[11px] text-[#006600] group-hover:text-[#00aa22] truncate mt-0.5 transition-colors">&gt; {chat.lastMessage}</p>
            </div>
          </button>
        ))}
      </div>
      
      <div className="p-4 border-t border-[#004400] hidden md:block">
        <div className="flex gap-2">
            {/* <button className="terminal-btn active flex-1 text-[10px] uppercase">tor:on</button> */}
            {/* <button className="terminal-btn flex-1 text-[10px] uppercase">pow:off</button> */}
        </div>
      </div>
    </div>
  );
};

export default ChatList;
