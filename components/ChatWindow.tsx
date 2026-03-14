import React, { useState, useRef, useEffect } from 'react';
import { Chat, Message } from '../types';
import { encryptionService } from '../services/encryptionService';
import { localStorageService } from '../services/localStorageService';
import ChatSettings from './ChatSettings';
import ChatHeader from './ChatHeader';
import MessageList from './MessageList';
import ChatInput from './ChatInput';
import MediaGallery from './MediaGallery';
import ForwardModal from './ForwardModal';
import { getGeohashChannelsInstance, GeohashMessage } from '../services/geohashChannels';

// Initialize the service instance
const geohashChannels = getGeohashChannelsInstance();

// === UUID fallback for older devices ===
function generateUUID(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return 'msg-' + Date.now() + '-' + Math.random().toString(36).substring(2, 15);
}

interface ChatWindowProps {
  chat: Chat | null;
  allChats: Chat[];
  myHandle: string;
  aiStreaming?: boolean;
  aiStreamingProvider?: string;
  onSendMessage: (text: string, options?: { imageUrl?: string, videoUrl?: string, replyTo?: Message['replyTo'], nostrRecipient?: string, encryptedData?: any }) => void;
  onForwardMessage: (message: Message, targetChatId: string) => void;
  onReaction: (messageId: string, emoji: string) => void;
  onDeleteMessage?: (messageId: string) => void;
  onClose?: () => void;
  onClearChatHistory?: (chatId: string) => void;
  className?: string;
  nostrRecipient?: string;
}

const ChatWindow: React.FC<ChatWindowProps> = ({
  chat,
  allChats,
  myHandle,
  aiStreaming = false,
  aiStreamingProvider = 'auto',
  onSendMessage,
  onForwardMessage,
  onReaction,
  onDeleteMessage,
  onClose,
  onClearChatHistory,
  className = "",
  nostrRecipient
}) => {
  // === State ===
  const [chatMessages, setChatMessages] = useState<GeohashMessage[]>([]);
  const [replyingTo, setReplyingTo] = useState<Message | null>(null);
  const [showForwardTarget, setShowForwardTarget] = useState<Message | null>(null);
  const [showChatSettings, setShowChatSettings] = useState(false);
  const [showGallery, setShowGallery] = useState(false);
  const [chatTheme, setChatTheme] = useState('default');
  const [chatBackground, setChatBackground] = useState('black');
  const [encryptionEnabled, setEncryptionEnabled] = useState(true);
  const [secureMode, setSecureMode] = useState(true);
  const [reactingToMessageId, setReactingToMessageId] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<Map<string, number>>(new Map());

  const scrollRef = useRef<HTMLDivElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);

  const emojis = ['🙂', '😎', '😜', '🔥', '💀', '👽', '👾', '🚀', '❤️', '👍', '👎', '✨'];

  // === Subscribe to Geohash Channel Messages ===
  useEffect(() => {
    if (!chat) return;

    const loadMessages = () => {
      const msgs = geohashChannels.getChannelMessages(chat.id);
      setChatMessages(msgs);
    };

    loadMessages();

    const unsubReceived = geohashChannels.subscribe('messageReceived', (msg: GeohashMessage) => {
      if (msg.channelId === chat.id) {
        setChatMessages(prev => prev.some(m => m.id === msg.id) ? prev : [...prev, msg]);
      }
    });

    const unsubSent = geohashChannels.subscribe('messageSent', (msg: GeohashMessage) => {
      if (msg.channelId === chat.id) {
        setChatMessages(prev => prev.some(m => m.id === msg.id) ? prev : [...prev, msg]);
      }
    });

    return () => {
      unsubReceived();
      unsubSent();
    };
  }, [chat?.id]);

  // === Scroll to bottom when messages update ===
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [chat?.messages]);

  // === Send Message ===
  const handleSendMessage = async (text: string, options?: { imageUrl?: string, videoUrl?: string, mediaId?: string }) => {
    if (!chat || !text) return;

    // Call parent's onSendMessage to handle the actual message sending
    onSendMessage(text, {
      imageUrl: options?.imageUrl,
      videoUrl: options?.videoUrl,
      replyTo: replyingTo ? { senderHandle: replyingTo.senderHandle, text: replyingTo.text } : undefined,
      nostrRecipient,
      encryptedData: undefined // Will be handled by parent
    });

    // Clear reply state after sending
    if (replyingTo) {
      setReplyingTo(null);
    }
  };

  // === Handle file uploads ===
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>, type: 'image' | 'video') => {
    const file = e.target.files?.[0];
    if (!file || isUploading) return;

    setIsUploading(true);
    const mediaId = `media_${Date.now()}`;
    setUploadProgress(prev => new Map(prev).set(mediaId, 0));

    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;

      if (type === 'image') {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');
          const maxDim = 1200;
          let { width, height } = img;
          if (width > maxDim || height > maxDim) {
            if (width > height) { height = (height * maxDim) / width; width = maxDim; }
            else { width = (width * maxDim) / height; height = maxDim; }
          }
          canvas.width = width;
          canvas.height = height;
          ctx?.drawImage(img, 0, 0, width, height);
          const compressed = canvas.toDataURL('image/jpeg', 0.8);
          handleSendMessage(`📎 Image: ${file.name}`, { imageUrl: compressed, mediaId });
          setIsUploading(false);
          setUploadProgress(prev => { const n = new Map(prev); n.delete(mediaId); return n; });
        };
        img.src = dataUrl;
      } else {
        handleSendMessage(`📎 Video: ${file.name}`, { videoUrl: dataUrl, mediaId });
        setIsUploading(false);
        setUploadProgress(prev => { const n = new Map(prev); n.delete(mediaId); return n; });
      }
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  // === Helpers for themes/colors ===
  const getChatBackgroundClass = () => {
    const bgMap: any = { black: 'bg-black', 'dark-gray': 'bg-gray-900', navy: 'bg-blue-950', forest: 'bg-green-950', burgundy: 'bg-red-950', charcoal: 'bg-gray-800' };
    return bgMap[chatBackground] || 'bg-black';
  };

  const getChatThemeClass = () => {
    const themeMap: any = { default: '', ocean: 'text-cyan-400', sunset: 'text-amber-400', matrix: 'text-[#00ff41]', blood: 'text-red-400', purple: 'text-purple-400' };
    return themeMap[chatTheme] || '';
  };

  const getUserColor = (senderId: string) => {
    if (senderId === 'me') return 'text-current';
    if (senderId === 'xit-bot') return 'text-cyan-400';
    if (senderId === 'system') return 'text-white opacity-40 italic';
    return 'text-orange-400';
  };

  // === Render ===
  if (!chat) {
    return (
      <div className={`flex-1 hidden md:flex flex-col items-center justify-center text-current opacity-30 gap-4 ${className}`}>
        <i className="fa-solid fa-slash text-4xl"></i>
        <p className="text-[10px] font-bold uppercase tracking-[0.2em]">waiting for peer connection...</p>
      </div>
    );
  }

  return (
    <div className={`flex-1 flex flex-col ${getChatBackgroundClass()} relative pt-safe ${className}`}>
      <input type="file" accept="image/*" className="hidden" ref={imageInputRef} onChange={(e) => handleFileChange(e, 'image')} />
      <input type="file" accept="video/*" className="hidden" ref={videoInputRef} onChange={(e) => handleFileChange(e, 'video')} />

      <ChatHeader
        chat={chat}
        myHandle={myHandle}
        aiStreaming={aiStreaming}
        aiStreamingProvider={aiStreamingProvider}
        secureMode={secureMode}
        encryptionEnabled={encryptionEnabled}
        onToggleSecureMode={() => setSecureMode(!secureMode)}
        onToggleEncryption={() => setEncryptionEnabled(!encryptionEnabled)}
        onClose={onClose}
        getChatThemeClass={getChatThemeClass}
        getUserColor={getUserColor}
      />

      <MessageList
        messages={chat?.messages || []}
        chat={chat}
        myHandle={myHandle}
        scrollRef={scrollRef}
        onReply={setReplyingTo}
        onForward={setShowForwardTarget}
        onReaction={onReaction}
        onDelete={onDeleteMessage}
        getUserColor={getUserColor}
        reactingToMessageId={reactingToMessageId}
        setReactingToMessageId={setReactingToMessageId}
        emojis={emojis}
        isPeerTyping={chat.isTyping}
      />

      <ChatInput
        onSendMessage={handleSendMessage}
        replyingTo={replyingTo}
        setReplyingTo={setReplyingTo}
        myHandle={myHandle}
        nostrRecipient={nostrRecipient}
        secureMode={secureMode}
        setSecureMode={setSecureMode}
        encryptionEnabled={encryptionEnabled}
        setEncryptionEnabled={setEncryptionEnabled}
        setShowChatSettings={setShowChatSettings}
        setShowGallery={setShowGallery}
        imageInputRef={imageInputRef}
        videoInputRef={videoInputRef}
        handleFileChange={handleFileChange}
        emojis={emojis}
      />

      <MediaGallery
        isOpen={showGallery}
        onClose={() => setShowGallery(false)}
        onSelect={(img) => { handleSendMessage('', { imageUrl: img.url }); setShowGallery(false); }}
        sampleImages={[
          { id: 's1', url: 'https://picsum.photos/seed/cyber1/400/400.jpg', caption: 'Cyber City', category: 'tech', size: '2.1MB' },
          { id: 's2', url: 'https://picsum.photos/seed/nature1/400/400.jpg', caption: 'Nature', category: 'nature', size: '1.8MB' },
          { id: 's3', url: 'https://picsum.photos/seed/matrix1/400/400.jpg', caption: 'Matrix', category: 'tech', size: '1.7MB' }
        ]}
        imageInputRef={imageInputRef}
        videoInputRef={videoInputRef}
      />

      <ForwardModal
        isOpen={!!showForwardTarget}
        onClose={() => setShowForwardTarget(null)}
        onForward={onForwardMessage}
        allChats={allChats}
        currentChatId={chat.id}
        message={showForwardTarget}
      />

      {showChatSettings && (
        <ChatSettings
          chat={chat}
          isOpen={showChatSettings}
          onClose={() => setShowChatSettings(false)}
          onClearHistory={() => onClearChatHistory?.(chat.id)}
          onMuteToggle={(muted) => console.log('Muted:', muted)}
          onThemeChange={setChatTheme}
          onBackgroundChange={setChatBackground}
        />
      )}
    </div>
  );
};

export default ChatWindow;