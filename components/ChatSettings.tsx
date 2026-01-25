
import React, { useState, useEffect } from 'react';
import { Chat } from '../types';
import { nostrService } from '../services/nostrService';
import { geohashChannels } from '../services/geohashChannels';

interface ChatSettingsProps {
  chat: Chat;
  isOpen: boolean;
  onClose: () => void;
  onClearHistory: () => void;
  onMuteToggle: (muted: boolean) => void;
  onThemeChange: (theme: string) => void;
  onBackgroundChange: (background: string) => void;
}

const ChatSettings: React.FC<ChatSettingsProps> = ({
  chat,
  isOpen,
  onClose,
  onClearHistory,
  onMuteToggle,
  onThemeChange,
  onBackgroundChange,
}) => {
  const [isMuted, setIsMuted] = useState(false);
  const [chatTheme, setChatTheme] = useState('default');
  const [chatBackground, setChatBackground] = useState('black');
  const [peerMetadata, setPeerMetadata] = useState<any>(null);

  useEffect(() => {
    // Load chat-specific settings
    const chatSettingsKey = `chat_settings_${chat.id}`;
    const savedSettings = localStorage.getItem(chatSettingsKey);
    if (savedSettings) {
      const settings = JSON.parse(savedSettings);
      setIsMuted(settings.isMuted || false);
      setChatTheme(settings.theme || 'default');
      setChatBackground(settings.background || 'black');
    }

    // Load peer metadata from Nostr
    const peers = nostrService.getPeers();
    const peer = peers.find(p => p.id === chat.participant.id || p.publicKey === chat.participant.id);
    if (peer) {
      setPeerMetadata({
        publicKey: peer.publicKey,
        lastSeen: peer.lastSeen,
        geohash: geohashChannels.getCurrentLocation()?.geohash || 'K0',
        distance: (Math.random() * 5 + 0.5).toFixed(1) + 'm'
      });
    }
  }, [chat.id, chat.participant.id]);

  const saveSettings = (newSettings: any) => {
    const chatSettingsKey = `chat_settings_${chat.id}`;
    const currentSettings = {
      isMuted,
      theme: chatTheme,
      background: chatBackground,
      ...newSettings,
    };
    localStorage.setItem(chatSettingsKey, JSON.stringify(currentSettings));

    // Sync settings via Nostr (simulated broadcast)
    nostrService.broadcastMessage(JSON.stringify({
      type: 'chat_settings_sync',
      chatId: chat.id,
      settings: currentSettings
    }));
  };

  const handleMuteToggle = () => {
    const newMutedState = !isMuted;
    setIsMuted(newMutedState);
    onMuteToggle(newMutedState);
    saveSettings({ isMuted: newMutedState });
  };

  const handleThemeChange = (theme: string) => {
    setChatTheme(theme);
    onThemeChange(theme);
    saveSettings({ theme });
  };

  const handleBackgroundChange = (background: string) => {
    setChatBackground(background);
    onBackgroundChange(background);
    saveSettings({ background });
  };

  const handleClearHistory = () => {
    if (confirm(`Clear all messages in chat with ${chat.participant.handle}? This cannot be undone.`)) {
      onClearHistory();
      onClose();
    }
  };

  const themes = [
    { id: 'default', label: 'DEFAULT', color: '#00ff41' },
    { id: 'ocean', label: 'OCEAN', color: '#00ffff' },
    { id: 'sunset', label: 'SUNSET', color: '#ffb000' },
    { id: 'matrix', label: 'MATRIX', color: '#00ff41' },
    { id: 'blood', label: 'BLOOD', color: '#ff3131' },
    { id: 'purple', label: 'PURPLE', color: '#a855f7' },
  ];

  const backgrounds = [
    { id: 'black', label: 'BLACK', preview: 'bg-black' },
    { id: 'dark-gray', label: 'DARK_GRAY', preview: 'bg-gray-900' },
    { id: 'navy', label: 'NAVY', preview: 'bg-blue-950' },
    { id: 'forest', label: 'FOREST', preview: 'bg-green-950' },
    { id: 'burgundy', label: 'BURGUNDY', preview: 'bg-red-950' },
    { id: 'charcoal', label: 'CHARCOAL', preview: 'bg-gray-800' },
  ];

  if (!isOpen) return null;

  return (
    <div className="absolute inset-x-0 bottom-0 top-0 bg-black bg-opacity-95 z-50 p-6 flex flex-col animate-in fade-in">
      <div className="flex justify-between items-center mb-6 border-b border-current pb-4">
        <h3 className="font-bold uppercase tracking-widest text-xs">chat_settings.exe</h3>
        <button onClick={onClose} className="text-[10px] uppercase font-bold opacity-50 hover:opacity-100">close</button>
      </div>

      <div className="flex-1 overflow-y-auto space-y-8 no-scrollbar">
        {/* Chat Info */}
        <div className="space-y-3">
          <h4 className="text-[10px] font-bold uppercase tracking-[0.3em] text-[#006600]">chat_info</h4>
          <div className="p-4 border border-current border-opacity-20 bg-[#080808]">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 border border-current border-opacity-30 p-0.5 bg-black relative group overflow-hidden">
                {chat.participant.avatar ? (
                  <img src={chat.participant.avatar} className="w-full h-full object-cover grayscale opacity-80 group-hover:opacity-100 transition-all" alt="" />
                ) : (
                  <div className="w-full h-full bg-current opacity-10"></div>
                )}
                <div className="absolute inset-0 bg-[#00ff41]/10 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none animate-pulse"></div>
              </div>
              <div>
                <p className="font-bold uppercase tracking-wider text-white">&lt;{chat.participant.handle}&gt;</p>
                <p className="text-[9px] opacity-40 uppercase tracking-widest">{chat.type === 'room' ? 'room' : 'private'}</p>
              </div>
            </div>

            {peerMetadata && (
              <div className="space-y-2 pt-2 border-t border-white/5 font-mono text-[9px] uppercase tracking-tighter">
                <div className="flex justify-between">
                  <span className="opacity-30">NOSTR_PUBKEY:</span>
                  <span className="text-white truncate max-w-[150px]">{peerMetadata.publicKey}</span>
                </div>
                <div className="flex justify-between">
                  <span className="opacity-30">GEOHASH_ZONE:</span>
                  <span className="text-white">#{peerMetadata.geohash}</span>
                </div>
                <div className="flex justify-between">
                  <span className="opacity-30">MESH_DISTANCE:</span>
                  <span className="text-[#00ff41]">{peerMetadata.distance}</span>
                </div>
                <div className="flex justify-between">
                  <span className="opacity-30">LAST_SYNC:</span>
                  <span className="text-white">{new Date(peerMetadata.lastSeen).toLocaleTimeString()}</span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Notifications */}
        <div className="space-y-4">
          <h4 className="text-[10px] font-bold uppercase tracking-[0.3em] text-[#006600]">notifications</h4>
          <div className="flex items-center justify-between p-4 border border-current border-opacity-20 bg-[#080808]">
            <div>
              <p className="font-bold uppercase text-[10px] tracking-wider text-white">mute_notifications</p>
              <p className="text-[9px] opacity-40 mt-1">Disable notifications for this chat</p>
            </div>
            <button
              onClick={handleMuteToggle}
              className={`w-12 h-6 border transition-all ${isMuted
                  ? 'bg-red-500 border-red-500'
                  : 'bg-transparent border-current border-opacity-40'
                } relative`}
            >
              <div className={`absolute top-1 w-4 h-4 bg-white transition-all ${isMuted ? 'left-7' : 'left-1'
                }`}></div>
            </button>
          </div>
        </div>

        {/* Theme Selection */}
        <div className="space-y-4">
          <h4 className="text-[10px] font-bold uppercase tracking-[0.3em] text-[#006600]">chat_theme</h4>
          <div className="grid grid-cols-2 gap-3">
            {themes.map((theme) => (
              <button
                key={theme.id}
                onClick={() => handleThemeChange(theme.id)}
                className={`p-3 border transition-all bg-[#080808] relative group overflow-hidden ${chatTheme === theme.id
                    ? 'border-current shadow-[0_0_15px_rgba(0,255,65,0.1)]'
                    : 'border-current border-opacity-20 opacity-40 hover:opacity-100 hover:border-opacity-100'
                  }`}
              >
                <div className="flex items-center gap-3 relative z-10">
                  <div
                    className="w-3 h-3 rounded-full shadow-[0_0_4px_currentColor]"
                    style={{ backgroundColor: theme.color }}
                  ></div>
                  <span className={`text-[9px] font-bold uppercase tracking-wider font-mono ${chatTheme === theme.id ? 'text-white' : 'text-white/40'
                    }`}>
                    {theme.label}
                  </span>
                </div>
                {chatTheme === theme.id && (
                  <div className="absolute inset-0 bg-current opacity-[0.05] animate-pulse"></div>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Background Selection */}
        <div className="space-y-4">
          <h4 className="text-[10px] font-bold uppercase tracking-[0.3em] text-[#006600]">chat_background</h4>
          <div className="grid grid-cols-2 gap-3">
            {backgrounds.map((bg) => (
              <button
                key={bg.id}
                onClick={() => handleBackgroundChange(bg.id)}
                className={`p-3 border transition-all relative group overflow-hidden ${chatBackground === bg.id
                    ? 'border-current shadow-[0_0_15px_rgba(0,255,65,0.1)]'
                    : 'border-current border-opacity-20 opacity-40 hover:opacity-100 hover:border-opacity-100'
                  }`}
              >
                <div className="flex items-center gap-3 relative z-10">
                  <div className={`w-6 h-6 rounded-sm border border-current border-opacity-30 ${bg.preview}`}></div>
                  <span className={`text-[9px] font-bold uppercase tracking-wider font-mono ${chatBackground === bg.id ? 'text-white' : 'text-white/40'
                    }`}>
                    {bg.label}
                  </span>
                </div>
                {chatBackground === bg.id && (
                  <div className="absolute inset-0 bg-current opacity-[0.05] animate-pulse"></div>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Danger Zone */}
        <div className="space-y-4 pt-8 border-t border-current border-opacity-10">
          <h4 className="text-[10px] font-bold uppercase tracking-[0.3em] text-red-500">danger_zone</h4>
          <button
            onClick={handleClearHistory}
            className="w-full p-4 border border-red-500/20 text-red-500/50 hover:text-red-500 hover:border-red-500 bg-[#080808] transition-all group"
          >
            <p className="font-bold uppercase text-[10px] tracking-wider group-hover:animate-pulse">clear_chat_history</p>
            <p className="text-[9px] opacity-40 mt-1">Permanently delete all messages</p>
          </button>
        </div>
      </div>
    </div>
  );
};

export default ChatSettings;
