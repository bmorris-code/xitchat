import React, { useState, useEffect } from 'react';
import { wifiP2P, WiFiPeer } from '../services/wifiP2P';
import { User } from '../types';

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

  useEffect(() => {
    // Listen for messages from this peer
    const unsubscribe = wifiP2P.on('messageReceived', (message) => {
      if (message.from === peer.id) {
        const chatMessage: ChatMessage = {
          id: message.id,
          from: 'peer',
          content: message.content,
          timestamp: new Date(message.timestamp)
        };
        setMessages(prev => [...prev, chatMessage]);
        
        // Clear typing indicator
        setTypingIndicator(false);
      }
    });

    // Listen for connection status changes
    const connectionUnsubscribe = wifiP2P.on('peerConnected', (connectedPeer) => {
      if (connectedPeer.id === peer.id) {
        setIsConnected(true);
      }
    });

    return () => {
      unsubscribe();
      connectionUnsubscribe();
    };
  }, [peer.id]);

  const sendMessage = () => {
    if (!newMessage.trim() || !isConnected) return;

    const success = wifiP2P.sendMessage(peer.id, newMessage);
    if (success) {
      const chatMessage: ChatMessage = {
        id: Math.random().toString(36).substr(2, 9),
        from: 'me',
        content: newMessage,
        timestamp: new Date()
      };
      setMessages(prev => [...prev, chatMessage]);
      setNewMessage('');
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
    <div className="flex-1 flex flex-col bg-black text-current font-mono">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-cyan-400/30">
        <div className="flex items-center gap-4">
          <button onClick={onBack} className="terminal-btn px-2 py-0 h-8 text-[10px] uppercase">back</button>
          <div>
            <h2 className="text-lg font-bold text-cyan-400">{peer.name}</h2>
            <p className="text-xs opacity-60">
              {peer.handle} • {isConnected ? '🟢 Connected' : '🔴 Disconnected'}
            </p>
          </div>
        </div>
        <div className="text-cyan-400 text-xs">
          📶 WiFi P2P
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.length === 0 && (
          <div className="text-center text-cyan-400/50 text-sm mt-8">
            <div className="text-4xl mb-4">📶</div>
            <p>WiFi P2P chat room</p>
            <p className="text-xs mt-2">Messages are sent directly between devices</p>
          </div>
        )}
        
        {messages.map((message) => (
          <div
            key={message.id}
            className={`flex ${message.from === 'me' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[70%] p-3 rounded-lg ${
                message.from === 'me'
                  ? 'bg-cyan-500/20 border border-cyan-400/50 text-cyan-400'
                  : 'bg-current/10 border border-current/30 text-current'
              }`}
            >
              <p className="text-sm">{message.content}</p>
              <p className="text-[8px] opacity-50 mt-1">
                {formatTime(message.timestamp)}
              </p>
            </div>
          </div>
        ))}
        
        {typingIndicator && (
          <div className="flex justify-start">
            <div className="bg-current/10 border border-current/30 px-3 py-2 rounded-lg">
              <p className="text-xs opacity-50">peer is typing...</p>
            </div>
          </div>
        )}
      </div>

      {/* Input */}
      <div className="border-t border-cyan-400/30 p-4">
        <div className="flex gap-2">
          <input
            type="text"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyPress={(e) => {
              if (e.key === 'Enter') {
                sendMessage();
              }
            }}
            placeholder={isConnected ? "Type a message..." : "Connect to send messages"}
            disabled={!isConnected}
            className="flex-1 bg-black border border-cyan-400/30 px-3 py-2 text-sm font-mono disabled:opacity-50"
          />
          <button
            onClick={sendMessage}
            disabled={!isConnected || !newMessage.trim()}
            className="terminal-btn active px-4 py-2 text-sm disabled:opacity-50"
          >
            send
          </button>
        </div>
        
        {!isConnected && (
          <div className="mt-2 text-xs text-cyan-400/60">
            💡 Tip: Click 'Connect' in the radar to establish P2P connection
          </div>
        )}
      </div>
    </div>
  );
};

export default WiFiChatRoom;
