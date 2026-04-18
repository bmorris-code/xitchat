import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Chat, Message } from '../types';
import { encryptionService } from '../services/encryptionService';
import { localStorageService } from '../services/localStorageService';
import ChatSettings from './ChatSettings';
import ChatHeader from './ChatHeader';
import MessageList from './MessageList';
import ChatInput from './ChatInput';
import MediaGallery from './MediaGallery';
import ForwardModal from './ForwardModal';
import VerifyPeerModal from './verify-peer-modal';
import { getGeohashChannelsInstance, GeohashMessage } from '../services/geohashChannels';

// ── FIX #4: removed unused generateUUID — crypto.randomUUID or Date.now fallback
// is used inline if needed ──

interface ChatWindowProps {
  chat: Chat | null;
  allChats: Chat[];
  myHandle: string;
  aiStreaming?: boolean;
  aiStreamingProvider?: string;
  onSendMessage: (text: string, options?: {
    imageUrl?: string;
    videoUrl?: string;
    replyTo?: Message['replyTo'];
    nostrRecipient?: string;
    encryptedData?: any;
  }) => void;
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
  const [verifyPeerPk, setVerifyPeerPk] = useState<string | null>(null);
  const [verifyPeerLabel, setVerifyPeerLabel] = useState<string | undefined>(undefined);

  // ── FIX #4: removed uploadProgress Map state — was never rendered,
  // isUploading bool is sufficient to guard the UI ──

  const scrollRef = useRef<HTMLDivElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);

  // ── FIX #1: use a ref so the instance is stable per component mount,
  // not created at module level where it fires before React is ready ──
  const geohashChannelsRef = useRef(getGeohashChannelsInstance());

  const emojis = ['🙂', '😎', '😜', '🔥', '💀', '👽', '👾', '🚀', '❤️', '👍', '👎', '✨'];

  // Convert GeohashMessage[] to Message[] for MessageList component
  const convertGeohashMessages = (geohashMsgs: GeohashMessage[]): Message[] => {
    return geohashMsgs.map(msg => ({
      id: msg.id,
      senderId: msg.nodeId,
      senderHandle: msg.nodeHandle,
      text: msg.content,
      timestamp: msg.timestamp,
      deliveryStatus: 'delivered' as const,
      type: msg.type
    }));
  };

  // Subscribe to geohash channel messages for the current chat
  useEffect(() => {
    if (!chat) return;
    const gc = geohashChannelsRef.current;

    // For room-type chats the geohash channel key is participant.id (e.g. 'room-gen'),
    // not the Chat UI id (e.g. 'chat-1775895866335').
    const channelKey = chat.type === 'room' ? chat.participant.id : chat.id;

    const msgs = gc.getChannelMessages(channelKey);
    console.log(`[CW] Loaded ${msgs.length} messages for channel ${channelKey}`);
    setChatMessages(msgs);

    const unsubReceived = gc.subscribe('messageReceived', (msg: GeohashMessage) => {
      console.log(`[CW] Received: ch=${msg.channelId} key=${channelKey} from=${msg.nodeHandle}`);
      if (msg.channelId === channelKey) {
        setChatMessages(prev => prev.some(m => m.id === msg.id) ? prev : [...prev, msg]);
      }
    });

    const unsubSent = gc.subscribe('messageSent', (msg: GeohashMessage) => {
      console.log(`[CW] Sent: ch=${msg.channelId} key=${channelKey} from=${msg.nodeHandle}`);
      if (msg.channelId === channelKey) {
        setChatMessages(prev => prev.some(m => m.id === msg.id) ? prev : [...prev, msg]);
      }
    });

    const unsubDeleted = gc.subscribe('messageDeleted', ({ channelId, messageId }: { channelId: string, messageId: string }) => {
      if (channelId === channelKey) {
        setChatMessages(prev => prev.filter(m => m.id !== messageId));
      }
    });

    return () => {
      unsubReceived();
      unsubSent();
      unsubDeleted();
    };
  }, [chat?.id, chat?.participant?.id, chat?.type]);

  // Scroll to bottom when messages update
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [chat?.messages, chatMessages, chat?.type]);

  const handleSendMessage = async (
    text: string,
    options?: { imageUrl?: string; videoUrl?: string; mediaId?: string }
  ) => {
    if (!chat) return;
    // ── FIX #2: allow empty text when media is provided (gallery image sends) ──
    if (!text && !options?.imageUrl && !options?.videoUrl) return;

    onSendMessage(text, {
      imageUrl: options?.imageUrl,
      videoUrl: options?.videoUrl,
      replyTo: replyingTo
        ? { senderHandle: replyingTo.senderHandle, text: replyingTo.text }
        : undefined,
      nostrRecipient,
      encryptedData: undefined
    });

    if (replyingTo) setReplyingTo(null);
  };

  const handleFileChange = async (
    e: React.ChangeEvent<HTMLInputElement>,
    type: 'image' | 'video'
  ) => {
    const file = e.target.files?.[0];
    if (!file || isUploading) return;

    setIsUploading(true);

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
          handleSendMessage(`📎 Image: ${file.name}`, { imageUrl: compressed });
          setIsUploading(false);
        };
        img.src = dataUrl;
      } else {
        handleSendMessage(`📎 Video: ${file.name}`, { videoUrl: dataUrl });
        setIsUploading(false);
      }
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const getChatBackgroundClass = () => {
    const bgMap: Record<string, string> = {
      black: 'bg-black', 'dark-gray': 'bg-gray-900', navy: 'bg-blue-950',
      forest: 'bg-green-950', burgundy: 'bg-red-950', charcoal: 'bg-gray-800'
    };
    return bgMap[chatBackground] || 'bg-black';
  };

  const getChatThemeClass = () => {
    const themeMap: Record<string, string> = {
      default: '', ocean: 'text-cyan-400', sunset: 'text-amber-400',
      matrix: 'text-[#00ff41]', blood: 'text-red-400', purple: 'text-purple-400'
    };
    return themeMap[chatTheme] || '';
  };

  const getUserColor = (senderId: string) => {
    if (senderId === 'me') return 'text-current';
    if (senderId === 'xit-bot') return 'text-cyan-400';
    if (senderId === 'system') return 'text-white opacity-40 italic';
    return 'text-orange-400';
  };

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
        messages={chat?.type === 'room' ? convertGeohashMessages(chatMessages) : chat?.messages || []}
        chat={chat}
        myHandle={myHandle}
        scrollRef={scrollRef}
        onReply={setReplyingTo}
        onForward={setShowForwardTarget}
        onReaction={onReaction}
        onDelete={onDeleteMessage}
        onVerifyPeer={(peerPk, peerLabel) => {
          setVerifyPeerPk(peerPk);
          setVerifyPeerLabel(peerLabel);
        }}
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
        onSelect={(img) => {
          // ── FIX #2: empty string text is now allowed when imageUrl is present ──
          handleSendMessage('', { imageUrl: img.url });
          setShowGallery(false);
        }}
        sampleImages={[]}
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

      <VerifyPeerModal
        isOpen={!!verifyPeerPk}
        peerPk={verifyPeerPk}
        peerLabel={verifyPeerLabel}
        onClose={() => {
          setVerifyPeerPk(null);
          setVerifyPeerLabel(undefined);
        }}
      />
    </div>
  );
};

export default ChatWindow;
