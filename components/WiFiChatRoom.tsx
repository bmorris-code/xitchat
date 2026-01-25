
import React, { useState, useEffect, useRef } from 'react';
import { wifiP2P, WiFiPeer } from '../services/wifiP2P';

interface WiFiChatRoomProps {
  peer: WiFiPeer;
  onBack: () => void;
}

interface ChatMessage {
  id: string;
  from: 'me' | 'peer';
  content: string;
  timestamp: Date;
}

const WiFiChatRoom: React.FC<WiFiChatRoomProps> = ({ peer, onBack }) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [isConnected, setIsConnected] = useState(peer.isConnected);
  const [typingIndicator, setTypingIndicator] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Scroll to bottom on new messages
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  useEffect(() => {
    // Listen for messages from this peer
    const unsubscribe = wifiP2P.subscribe('messageReceived', (message) => {
      if (message.from === peer.id) {
        const chatMessage: ChatMessage = {
          id: message.id,
          from: 'peer',
          content: message.content,
          timestamp: new Date(message.timestamp)
        };
        setMessages(prev => [...prev, chatMessage]);
        setTypingIndicator(false);
      }
    });

    // Listen for connection status changes
    const connectionUnsubscribe = wifiP2P.subscribe('peerConnected', (connectedPeer) => {
      if (connectedPeer.id === peer.id) {
        setIsConnected(true);
      }
    });

    const disconnectionUnsubscribe = wifiP2P.subscribe('peerDisconnected', (disconnectedPeer) => {
      if (disconnectedPeer.id === peer.id) {
        setIsConnected(false);
      }
    });

    return () => {
      unsubscribe();
      connectionUnsubscribe();
      disconnectionUnsubscribe();
    };
  }, [peer.id]);

  const handleSendMessage = async () => {
    if (!newMessage.trim() || !isConnected) return;

    const content = newMessage;
    setNewMessage('');

    try {
      await wifiP2P.sendMessage(peer.id, content);
      const chatMessage: ChatMessage = {
        id: Math.random().toString(36).substr(2, 9),
        from: 'me',
        content: content,
        timestamp: new Date()
      };
      setMessages(prev => [...prev, chatMessage]);
    } catch (error) {
      console.error('Failed to send message:', error);
      alert('Failed to send message via P2P.');
    }
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    });
  };

  return (
    <div className="flex-1 flex flex-col bg-black text-current font-mono no-scrollbar animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-current border-opacity-30 bg-[#050505]">
        <div className="flex items-center gap-4">
          <button
            onClick={onBack}
            className="terminal-btn px-3 py-1 text-[10px] uppercase font-bold"
          >
            &lt; back
          </button>
          <div>
            <h2 className="text-lg font-bold uppercase tracking-tighter glow-text text-white">
              {peer.name.toLowerCase()}
            </h2>
            <div className="flex items-center gap-2">
              <div className={`w-1.5 h-1.5 rounded-full ${isConnected ? 'bg-[#00ff41] animate-pulse shadow-[0_0_5px_#00ff41]' : 'bg-red-500'}`}></div>
              <p className="text-[9px] font-bold opacity-40 uppercase tracking-widest">
                {peer.handle} • {isConnected ? 'uplink_active' : 'uplink_offline'}
              </p>
              <div className="ml-2 flex items-center gap-1 text-[8px] text-[#00ff41] border border-[#00ff41]/30 px-1 font-black uppercase tracking-tighter bg-[#00ff41]/5">
                <i className="fa-solid fa-shield-halved text-[7px]"></i>
                E2EE_ACTIVE
              </div>
            </div>
          </div>
        </div>
        <div className="text-right">
          <p className="text-[9px] font-bold text-[#00ff41] opacity-60 uppercase tracking-[0.2em]">p2p_direct_link</p>
          <p className="text-[8px] opacity-30 font-mono">{peer.id.substring(0, 12)}</p>
        </div>
      </div>

      {/* Messages Area */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-6 space-y-6 no-scrollbar bg-[#020202]"
      >
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full opacity-20 space-y-4">
            <i className="fa-solid fa-satellite-dish text-5xl"></i>
            <div className="text-center">
              <p className="text-xs font-bold uppercase tracking-[0.3em]">secure_channel_established</p>
              <p className="text-[10px] mt-2">no_transmissions_recorded</p>
            </div>
          </div>
        )}

        {messages.map((message) => (
          <div
            key={message.id}
            className={`flex ${message.from === 'me' ? 'justify-end' : 'justify-start'} animate-in slide-in-from-bottom-2 duration-300`}
          >
            <div
              className={`max-w-[80%] p-4 relative ${message.from === 'me'
                ? 'bg-[#00ff41]/5 border border-[#00ff41]/30 text-white'
                : 'bg-white/5 border border-white/10 text-white/90'
                }`}
            >
              {/* Decorative corner for "me" messages */}
              {message.from === 'me' && (
                <div className="absolute -top-px -right-px w-2 h-2 border-t border-r border-[#00ff41]"></div>
              )}

              <p className="text-xs leading-relaxed">{message.content}</p>
              <div className={`flex items-center gap-2 mt-2 opacity-30 text-[8px] font-bold uppercase tracking-widest ${message.from === 'me' ? 'justify-end' : 'justify-start'}`}>
                <i className="fa-solid fa-lock text-[6px]"></i>
                <span>{formatTime(message.timestamp)}</span>
                {message.from === 'me' && <i className="fa-solid fa-check-double text-[6px]"></i>}
              </div>
            </div>
          </div>
        ))}

        {typingIndicator && (
          <div className="flex justify-start animate-pulse">
            <div className="bg-white/5 border border-white/10 px-3 py-2">
              <p className="text-[9px] opacity-40 uppercase tracking-widest">peer_is_typing...</p>
            </div>
          </div>
        )}
      </div>

      {/* Input Area */}
      <div className="p-6 bg-[#050505] border-t border-current border-opacity-10">
        <div className="flex gap-3">
          <div className="flex-1 relative">
            <input
              type="text"
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              onKeyPress={(e) => {
                if (e.key === 'Enter') {
                  handleSendMessage();
                }
              }}
              placeholder={isConnected ? "enter_transmission..." : "awaiting_uplink_connection..."}
              disabled={!isConnected}
              className="w-full bg-black border border-current border-opacity-20 px-4 py-3 text-xs text-white font-mono placeholder-white/10 focus:border-opacity-100 outline-none transition-all"
            />
            {isConnected && (
              <div className="absolute right-3 top-1/2 -translate-y-1/2 w-1.5 h-1.5 bg-[#00ff41] rounded-full animate-pulse shadow-[0_0_5px_#00ff41]"></div>
            )}
          </div>
          <button
            onClick={handleSendMessage}
            disabled={!isConnected || !newMessage.trim()}
            className="terminal-btn active px-8 py-3 text-[10px] uppercase font-bold disabled:opacity-20"
          >
            transmit
          </button>
        </div>

        {!isConnected && (
          <div className="mt-3 flex items-center gap-2 text-[9px] text-amber-500/60 uppercase tracking-widest">
            <i className="fa-solid fa-triangle-exclamation"></i>
            <span>Warning: peer is currently unreachable via direct p2p link</span>
          </div>
        )}
      </div>
    </div>
  );
};

export default WiFiChatRoom;
