
import React, { useState, useRef, useEffect } from 'react';
import { Chat, Message } from '../types';
import { torService } from '../services/torService';
import { powService } from '../services/powService';
import { hybridMesh } from '../services/hybridMesh';
import { encryptionService } from '../services/encryptionService';
import { privacyService } from '../services/privacyService';
import { localStorageService } from '../services/localStorageService';
import ChatSettings from './ChatSettings';
import SecureImageView from './SecureImageView';

interface ChatWindowProps {
  chat: Chat | null;
  allChats: Chat[];
  myHandle: string;
  onSendMessage: (text: string, options?: { replyTo?: Message['replyTo']; imageUrl?: string; videoUrl?: string, nostrRecipient?: string }) => void;
  onForwardMessage: (message: Message, targetChatId: string) => void;
  onReaction: (messageId: string, emoji: string) => void;
  onDeleteMessage?: (messageId: string) => void;
  onGiftMoola?: (amount: number) => void;
  onOpenGallery?: () => void;
  onClose?: () => void;
  onClearChatHistory?: (chatId: string) => void;
  className?: string;
  nostrRecipient?: string;
}

// Add experimental Contacts API interface
interface ExperimentalNavigator extends Navigator {
  contacts?: {
    select: (properties: string[]) => Promise<any[]>;
  };
}

// Add Contacts API interface
interface ContactsAPI {
  select: (properties: string[]) => Promise<any[]>;
}

interface Navigator {
  contacts?: ContactsAPI;
}

const ChatWindow: React.FC<ChatWindowProps> = ({ chat, allChats, myHandle, onSendMessage, onForwardMessage, onReaction, onDeleteMessage, onGiftMoola, onOpenGallery, onClose, onClearChatHistory, className = "", nostrRecipient }) => {
  const [inputText, setInputText] = useState('');
  const [showEmojiMenu, setShowEmojiMenu] = useState(false);
  const [reactingToMessageId, setReactingToMessageId] = useState<string | null>(null);
  const [replyingTo, setReplyingTo] = useState<Message | null>(null);
  const [showForwardTarget, setShowForwardTarget] = useState<Message | null>(null);
    const [showChatSettings, setShowChatSettings] = useState(false);
  const [chatTheme, setChatTheme] = useState('default');
  const [chatBackground, setChatBackground] = useState('black');
  const [torStatus, setTorStatus] = useState<any>(null);
  const [encryptionEnabled, setEncryptionEnabled] = useState(true);
  const [secureMode, setSecureMode] = useState(true);
  const [powStats, setPowStats] = useState<any>(null);
  const [meshStatus, setMeshStatus] = useState<{ connected: boolean; type: string; peers: number }>({ connected: false, type: 'simulation', peers: 0 });
  const [showGallery, setShowGallery] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);

  const emojis = ['🙂', '😎', '😜', '🔥', '💀', '👽', '👾', '🚀', '❤️', '👍', '👎', '✨'];

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [chat?.messages]);

  // Initialize TOR, POW, and Mesh status
  useEffect(() => {
    // Initialize TOR status
    const initTor = () => {
      const status = torService.getStatus();
      setTorStatus(status);
    };

    // Initialize POW stats
    const initPow = () => {
      const stats = powService.getStats();
      setPowStats(stats);
    };

    // Initialize Mesh status
    const initMesh = () => {
      const connectionInfo = hybridMesh.getConnectionInfo();
      const peers = hybridMesh.getPeers();
      const activeServices = hybridMesh.getActiveServices();
      
      // Determine the primary connection type
      let primaryType = 'none';
      if (activeServices.bluetooth) primaryType = 'bluetooth';
      else if (activeServices.webrtc) primaryType = 'webrtc';
      else if (activeServices.wifi) primaryType = 'wifi';
      else if (activeServices.nostr) primaryType = 'nostr';
      else if (activeServices.broadcast) primaryType = 'broadcast';
      else if (activeServices.local) primaryType = 'local';
      
      setMeshStatus({
        connected: connectionInfo.isConnected,
        type: primaryType,
        peers: connectionInfo.peerCount
      });
    };

    initTor();
    initPow();
    initMesh();

    // Subscribe to TOR updates
    const torUnsubscribe = torService.subscribe('statusChanged', initTor);
    const powUnsubscribe = powService.subscribe('statsChanged', initPow);
    const meshUnsubscribePeers = hybridMesh.subscribe('peersUpdated', initMesh);
    const meshUnsubscribeConnection = hybridMesh.subscribe('connectionChanged', initMesh);

    return () => {
      torUnsubscribe();
      powUnsubscribe();
      meshUnsubscribePeers();
      meshUnsubscribeConnection();
    };
  }, []);

  // Sample gallery images
  const sampleGalleryImages = [
    {
      id: 'sample-1',
      url: 'https://picsum.photos/seed/cyberpunk1/400/400.jpg',
      caption: 'Cyberpunk City',
      category: 'tech',
      size: '2.1MB'
    },
    {
      id: 'sample-2',
      url: 'https://picsum.photos/seed/nature1/400/400.jpg',
      caption: 'Nature Scene',
      category: 'nature',
      size: '1.8MB'
    },
    {
      id: 'sample-3',
      url: 'https://picsum.photos/seed/abstract1/400/400.jpg',
      caption: 'Abstract Art',
      category: 'art',
      size: '1.5MB'
    },
    {
      id: 'sample-4',
      url: 'https://picsum.photos/seed/retro1/400/400.jpg',
      caption: 'Retro Tech',
      category: 'tech',
      size: '2.3MB'
    },
    {
      id: 'sample-5',
      url: 'https://picsum.photos/seed/space1/400/400.jpg',
      caption: 'Space Scene',
      category: 'sci-fi',
      size: '1.9MB'
    },
    {
      id: 'sample-6',
      url: 'https://picsum.photos/seed/matrix1/400/400.jpg',
      caption: 'Matrix Code',
      category: 'tech',
      size: '1.7MB'
    },
    {
      id: 'sample-7',
      url: 'https://picsum.photos/seed/neon1/400/400.jpg',
      caption: 'Neon Lights',
      category: 'urban',
      size: '2.0MB'
    },
    {
      id: 'sample-8',
      url: 'https://picsum.photos/seed/minimal1/400/400.jpg',
      caption: 'Minimal Design',
      category: 'art',
      size: '1.4MB'
    }
  ];

  // Gallery image handlers
  const handleGalleryImageSelect = (img: any) => {
    console.log('Gallery image selected:', img.url);
    onSendMessage('', { imageUrl: img.url });
    setShowGallery(false);
  };

  const handleImagePreview = (img: any) => {
    const modal = document.createElement('div');
    modal.className = 'fixed inset-0 z-[300] bg-black/95 flex items-center justify-center p-6 cursor-pointer';
    modal.innerHTML = `
      <div class="relative max-w-4xl max-h-full">
        <img src="${img.url}" class="max-w-full max-h-full rounded" alt="${img.caption}" />
        <div class="absolute bottom-0 left-0 right-0 bg-black/80 p-4 rounded-b">
          <h3 class="text-white font-bold">${img.caption}</h3>
          <p class="text-white/60 text-sm">${img.category} • ${img.size}</p>
        </div>
        <button class="absolute top-4 right-4 bg-red-500 text-white px-3 py-1 rounded">Close</button>
      </div>
    `;
    modal.onclick = (e) => {
      if (e.target === modal) modal.remove();
    };
    document.body.appendChild(modal);
  };

  const handleDeleteImage = (imageId: string) => {
    if (confirm('Delete this image from gallery?')) {
      const savedImages = localStorage.getItem('xitchat_gallery_images');
      const images = savedImages ? JSON.parse(savedImages) : [];
      const filteredImages = images.filter((img: any) => img.id !== imageId);
      localStorage.setItem('xitchat_gallery_images', JSON.stringify(filteredImages));
      // Force re-render
      setShowGallery(false);
      setTimeout(() => setShowGallery(true), 100);
    }
  };

  if (!chat) {
    return (
      <div className={`flex-1 hidden md:flex flex-col items-center justify-center text-current opacity-30 gap-4 ${className}`}>
        <i className="fa-solid fa-slash text-4xl"></i>
        <p className="text-[10px] font-bold uppercase tracking-[0.2em]">waiting for peer connection...</p>
      </div>
    );
  }

  const handleSend = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!inputText.trim() || !chat) return;

    try {
      let messageText = inputText.trim();
      let encryptedData = null;

      // Encrypt message if encryption is enabled
      if (encryptionEnabled && secureMode && chat.participant.id !== 'xit-bot') {
        try {
          // Ensure we have encryption keys
          if (!encryptionService.hasUserKeys('me')) {
            await encryptionService.initializeUser('me');
          }
          
          // Ensure recipient has keys
          if (!encryptionService.hasUserKeys(chat.participant.id)) {
            // In a real app, you'd exchange public keys first
            // For demo, we'll generate a key for the recipient
            await encryptionService.generateKeyPair(chat.participant.id);
          }

          // Encrypt the message
          encryptedData = await encryptionService.encryptMessage(messageText, chat.participant.id);
          messageText = `[ENCRYPTED] ${encryptedData.data.substring(0, 20)}...`;
        } catch (error) {
          console.error('Encryption failed, sending plain text:', error);
          // Fall back to plain text if encryption fails
        }
      }

      // Send message (encrypted or plain)
      onSendMessage(messageText, { 
        replyTo: replyingTo ? { id: replyingTo.id, senderHandle: replyingTo.senderHandle || '', text: replyingTo.text } : undefined,
        nostrRecipient: nostrRecipient
      });

      // Store encrypted version if encryption was used
      if (encryptedData) {
        await localStorageService.storeEncryptedMessage(
          chat.id, 
          `msg-${Date.now()}`, 
          encryptedData
        );
      }

      setInputText('');
      setReplyingTo(null);
    } catch (error) {
      console.error('Failed to send message:', error);
    }
  };


  const handleAddReaction = (messageId: string, emoji: string) => {
    onReaction(messageId, emoji);
    setReactingToMessageId(null);
  };

  // Enhanced media storage system
  const [mediaStorage, setMediaStorage] = useState<Map<string, { url: string; type: 'image' | 'video'; name: string; size: number; timestamp: number }>>(new Map());
  const [uploadProgress, setUploadProgress] = useState<Map<string, number>>(new Map());
  const [isUploading, setIsUploading] = useState(false);

  
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>, type: 'image' | 'video') => {
    const file = e.target.files?.[0];
    if (!file || isUploading) return;

    setIsUploading(true);
    console.log('Starting file upload:', file.name, 'Type:', type);

    try {
      // Check file size
      const maxSize = type === 'image' ? 10 * 1024 * 1024 : 50 * 1024 * 1024;
      if (file.size > maxSize) {
        alert(`File too large. Maximum size: ${type === 'image' ? '10MB' : '50MB'}`);
        return;
      }

      // Generate unique ID for the media
      const mediaId = `media_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      // Show upload progress
      setUploadProgress(prev => new Map(prev.set(mediaId, 0)));

      // Process file based on type
      if (type === 'image') {
        await processImageFile(file, mediaId);
      } else {
        await processVideoFile(file, mediaId);
      }

    } catch (error) {
      console.error('File processing error:', error);
      alert(`Failed to process ${type}. Please try again.`);
    } finally {
      // Clear the input and reset uploading state
      e.target.value = '';
      setIsUploading(false);
      console.log('File upload completed');
    }
  };

  // Process image files with compression
  const processImageFile = async (file: File, mediaId: string) => {
    return new Promise<void>((resolve, reject) => {
      const reader = new FileReader();
      
      reader.onload = async (event) => {
        try {
          const dataUrl = event.target?.result as string;
          
          // Create image element for compression
          const img = new Image();
          img.onload = () => {
            // Create canvas for compression
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            
            if (!ctx) {
              reject(new Error('Canvas context not available'));
              return;
            }

            // Calculate new dimensions (max 1200px width/height)
            let { width, height } = img;
            const maxDimension = 1200;
            
            if (width > maxDimension || height > maxDimension) {
              if (width > height) {
                height = (height * maxDimension) / width;
                width = maxDimension;
              } else {
                width = (width * maxDimension) / height;
                height = maxDimension;
              }
            }

            canvas.width = width;
            canvas.height = height;

            // Draw and compress
            ctx.drawImage(img, 0, 0, width, height);
            
            // Convert to compressed data URL
            const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.8);
            
            // Store media
            const mediaInfo = {
              url: compressedDataUrl,
              type: 'image' as const,
              name: file.name,
              size: compressedDataUrl.length,
              timestamp: Date.now()
            };

            setMediaStorage(prev => new Map(prev.set(mediaId, mediaInfo)));
            
            // Send message with media
            const fileInfo = `📎 Image: ${file.name} (${(file.size / 1024 / 1024).toFixed(2)}MB)`;
            console.log('Sending image message:', fileInfo);
            onSendMessage(fileInfo, { imageUrl: compressedDataUrl, mediaId });
            
            // Remove progress
            setUploadProgress(prev => {
              const newMap = new Map(prev);
              newMap.delete(mediaId);
              return newMap;
            });
            
            resolve();
          };
          
          img.onerror = () => reject(new Error('Image loading failed'));
          img.src = dataUrl;
          
        } catch (error) {
          reject(error);
        }
      };
      
      reader.onerror = () => reject(new Error('File reading failed'));
      reader.readAsDataURL(file);
    });
  };

  // Process video files
  const processVideoFile = async (file: File, mediaId: string) => {
    return new Promise<void>((resolve, reject) => {
      const reader = new FileReader();
      
      reader.onload = (event) => {
        try {
          const dataUrl = event.target?.result as string;
          
          // Store video (videos are not compressed due to complexity)
          const mediaInfo = {
            url: dataUrl,
            type: 'video' as const,
            name: file.name,
            size: file.size,
            timestamp: Date.now()
          };

          setMediaStorage(prev => new Map(prev.set(mediaId, mediaInfo)));
          
          // Send message with video
          const fileInfo = `📎 Video: ${file.name} (${(file.size / 1024 / 1024).toFixed(2)}MB)`;
          onSendMessage(fileInfo, { videoUrl: dataUrl, mediaId });
          
          // Remove progress
          setUploadProgress(prev => {
            const newMap = new Map(prev);
            newMap.delete(mediaId);
            return newMap;
          });
          
          resolve();
        } catch (error) {
          reject(error);
        }
      };
      
      reader.onerror = () => reject(new Error('File reading failed'));
      reader.readAsDataURL(file);
    });
  };

  // Handle drag and drop with enhanced processing
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    const files = Array.from(e.dataTransfer.files) as File[];
    
    for (const file of files) {
      try {
        // Create a synthetic event for file processing
        const syntheticEvent = {
          target: { files: [file], value: '' }
        } as React.ChangeEvent<HTMLInputElement>;
        
        if (file.type.startsWith('image/')) {
          await handleFileChange(syntheticEvent, 'image');
        } else if (file.type.startsWith('video/')) {
          await handleFileChange(syntheticEvent, 'video');
        } else {
          console.log('Unsupported file type:', file.type);
        }
      } catch (error) {
        console.error('Error processing dropped file:', error);
      }
    }
  };

  // Enhanced message rendering with media support
  const renderMessageContent = (msg: any) => {
    if (msg.imageUrl) {
      return (
        <div className="space-y-2">
          <p className="text-current break-words">{msg.text}</p>
          <div className="relative group">
            {msg.text.startsWith('[ENCRYPTED_IMAGE]') ? (
              <SecureImageView
                imageId={`img-${msg.id}`}
                senderId={msg.senderId}
                className="max-w-xs rounded border border-current border-opacity-30"
                onPermissionDenied={() => {
                  console.log('Image access denied');
                }}
              />
            ) : (
              <img
                src={msg.imageUrl}
                alt="Shared image"
                className="max-w-xs rounded border border-current border-opacity-30 cursor-pointer hover:border-opacity-100 transition-all"
                onClick={() => {
                  // Open image in full view
                  const modal = document.createElement('div');
                  modal.className = 'fixed inset-0 bg-black bg-opacity-95 z-50 flex items-center justify-center p-4';
                  modal.innerHTML = `
                    <div class="relative max-w-4xl max-h-full">
                      <img src="${msg.imageUrl}" class="max-w-full max-h-full rounded" />
                      <button class="absolute top-4 right-4 bg-red-500 text-white px-3 py-1 rounded">Close</button>
                    </div>
                  `;
                  modal.onclick = (e) => {
                    if (e.target === modal) modal.remove();
                  };
                  document.body.appendChild(modal);
                }}
              />
            )}
            <div className="absolute bottom-2 right-2 bg-black/80 px-2 py-1 rounded text-xs opacity-0 group-hover:opacity-100 transition-opacity">
              Click to expand
            </div>
          </div>
        </div>
      );
    }
    
    if (msg.videoUrl) {
      return (
        <div className="space-y-2">
          <p className="text-current break-words">{msg.text}</p>
          <div className="relative group">
            <video 
              src={msg.videoUrl} 
              controls 
              className="max-w-full rounded border border-current border-opacity-30"
            />
            <div className="absolute top-2 right-2 bg-black/80 px-2 py-1 rounded text-xs">
              Video
            </div>
          </div>
        </div>
      );
    }
    
    return <p className="text-current break-words">{msg.text}</p>;
  };

  const handleTorToggle = () => {
    try {
      if (torStatus?.connected) {
        torService.disableTor();
      } else {
        torService.enableTor();
      }
    } catch (error) {
      console.error('Failed to toggle TOR:', error);
    }
  };

  const handlePowToggle = () => {
    try {
      if (powStats?.enabled) {
        powService.disablePOW();
      } else {
        powService.enablePOW();
      }
    } catch (error) {
      console.error('Failed to toggle POW:', error);
    }
  };

  const handleClearHistory = () => {
    if (onClearChatHistory && chat) {
      onClearChatHistory(chat.id);
    }
  };

  const handleMuteToggle = (muted: boolean) => {
    // Handle mute functionality - could be expanded to actually mute notifications
    console.log(`Chat ${chat?.id} ${muted ? 'muted' : 'unmuted'}`);
  };

  const handleThemeChange = (theme: string) => {
    setChatTheme(theme);
  };

  const handleBackgroundChange = (background: string) => {
    setChatBackground(background);
  };

  const getChatBackgroundClass = () => {
    const backgroundMap: { [key: string]: string } = {
      black: 'bg-black',
      'dark-gray': 'bg-gray-900',
      navy: 'bg-blue-950',
      forest: 'bg-green-950',
      burgundy: 'bg-red-950',
      charcoal: 'bg-gray-800',
    };
    return backgroundMap[chatBackground] || 'bg-black';
  };

  const getChatThemeClass = () => {
    const themeMap: { [key: string]: string } = {
      default: '',
      ocean: 'text-cyan-400',
      sunset: 'text-amber-400',
      matrix: 'text-green-400',
      blood: 'text-red-400',
      purple: 'text-purple-400',
    };
    return themeMap[chatTheme] || '';
  };

  const getUserColor = (senderId: string) => {
    if (senderId === 'me') return 'text-current';
    if (senderId === 'xit-bot') return 'text-cyan-400';
    if (senderId === 'system') return 'text-white opacity-40 italic';
    return 'text-orange-400';
  };

  return (
    <div className={`flex-1 flex flex-col ${getChatBackgroundClass()} relative pt-safe ${className}`}>
      {/* Hidden inputs for media */}
      <input type="file" accept="image/*" className="hidden" ref={imageInputRef} onChange={(e) => handleFileChange(e, 'image')} />
      <input type="file" accept="video/*" className="hidden" ref={videoInputRef} onChange={(e) => handleFileChange(e, 'video')} />

      {/* Header */}
      <div className="px-3 sm:px-6 py-2 sm:py-4 border-b border-[#004400] flex items-center justify-between z-30 min-h-0">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1 max-w-[50%] sm:max-w-[60%]">
          <span className={`font-bold truncate text-sm sm:text-base glow-text ${chat.type === 'room' ? 'text-white' : getUserColor(chat.participant.id)} ${getChatThemeClass()}`}>
            {chat.type === 'room' ? 'node_room/' : 'xitchat/'}<span className="uppercase tracking-widest text-xs sm:text-sm">{chat.participant.handle}</span>
          </span>
          <div className="w-2 h-2 rounded-full bg-[#00ff41] animate-pulse flex-shrink-0"></div>
        </div>
        <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
          <span className="hidden lg:inline text-[9px] font-bold uppercase tracking-widest opacity-40">protocol:secure_v4</span>
          
          {/* Security Status Indicator */}
          <div 
            className={`flex items-center justify-center w-6 h-6 sm:w-auto sm:px-2 sm:py-1 rounded text-[8px] font-bold uppercase tracking-widest transition-all ${
              secureMode && encryptionEnabled 
                ? 'bg-green-500/20 text-green-400 border border-green-500/50' 
                : secureMode 
                ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/50'
                : 'bg-red-500/20 text-red-400 border border-red-500/50'
            }`}
            title={
              secureMode && encryptionEnabled 
                ? '🔒 End-to-end encrypted' 
                : secureMode 
                ? '⚠️ Secure mode, no encryption'
                : '🔓 Insecure mode'
            }
          >
            {secureMode && encryptionEnabled ? '🔒' : secureMode ? '⚠️' : '🔓'}
          </div>
          
          {/* WebRTC Mesh Status */}
          <div className="flex items-center gap-1">
            <div 
              className={`flex items-center justify-center w-6 h-6 sm:w-auto sm:px-2 sm:py-1 rounded text-[8px] font-bold uppercase tracking-widest transition-all ${
                meshStatus.connected 
                  ? 'bg-green-500/20 text-green-400 border border-green-500/50' 
                  : 'bg-gray-500/20 text-gray-400 border border-gray-500/50'
              }`}
              title={meshStatus.connected ? `${meshStatus.type.toUpperCase()} Connected (${meshStatus.peers} peers)` : 'Mesh Offline'}
            >
              <span className="text-[8px] sm:text-xs">🔗</span>
            </div>
          </div>
          
          {/* TOR Status */}
          <div className="flex items-center gap-1">
            <button 
              onClick={handleTorToggle}
              className={`flex items-center justify-center w-6 h-6 sm:w-auto sm:px-2 sm:py-1 rounded text-[8px] font-bold uppercase tracking-widest transition-all ${
                torStatus?.connected 
                  ? 'bg-green-500/20 text-green-400 border border-green-500/50' 
                  : 'bg-red-500/20 text-red-400 border border-red-500/50'
              }`}
              title={torStatus?.connected ? 'TOR Connected' : 'TOR Disconnected'}
            >
              <i className="fa-solid fa-shield-halved text-[8px] sm:text-xs"></i>
              <span className="hidden sm:inline ml-1">TOR</span>
            </button>
          </div>

          {/* POW Status */}
          <div className="flex items-center gap-1">
            <button 
              onClick={handlePowToggle}
              className={`flex items-center justify-center w-6 h-6 sm:w-auto sm:px-2 sm:py-1 rounded text-[8px] font-bold uppercase tracking-widest transition-all ${
                powStats?.enabled 
                  ? 'bg-blue-500/20 text-blue-400 border border-blue-500/50' 
                  : 'bg-gray-500/20 text-gray-400 border border-gray-500/50'
              }`}
              title={powStats?.enabled ? 'POW Mining Active' : 'POW Mining Inactive'}
            >
              <i className="fa-solid fa-bolt text-[8px] sm:text-xs"></i>
              <span className="hidden sm:inline ml-1">POW</span>
            </button>
          </div>

          {onClose && <button onClick={onClose} className="terminal-btn text-[10px] sm:text-xs px-1 sm:px-2 py-0 h-6 sm:h-8 min-h-0 uppercase whitespace-nowrap">close</button>}
        </div>
      </div>

      {/* Messages Area with Drag & Drop */}
      <div 
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-3 sm:p-6 space-y-4 relative"
        onDragOver={handleDragOver}
        onDrop={handleDrop}
      >
        <div className="text-[10px] opacity-20 mb-8 font-mono uppercase tracking-[0.3em] text-center border-b border-[#004400] pb-2">
          - session_initialized: {new Date().toLocaleDateString()} -
        </div>
        {chat.messages.map((msg) => (
          <div key={msg.id} className="group flex flex-col font-mono relative animate-in fade-in slide-in-from-left-2">
            {msg.replyTo && (
              <div className="mb-1 ml-4 border-l-2 border-current border-opacity-20 pl-3 py-1 opacity-40 text-[10px] italic group-hover:opacity-80 transition-opacity">
                <span className="font-bold">&lt;{msg.replyTo.senderHandle}&gt;</span> {msg.replyTo.text.substring(0, 30)}...
              </div>
            )}
            
            <div className="flex justify-between items-baseline mb-1">
              <div className="flex items-center gap-2">
                <span className={`${getUserColor(msg.senderId)} font-bold`}>
                  &lt;{msg.senderId === 'me' ? myHandle : (msg.senderHandle || chat.participant.handle)}&gt;
                </span>
                <span className="opacity-30 text-[9px]">[{new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}]</span>
              </div>
              
              <div className="hidden group-hover:flex items-center gap-4 opacity-40 transition-opacity">
                <button onClick={() => setReplyingTo(msg)} title="Reply" className="hover:text-white hover:opacity-100 transition-all active:scale-90"><i className="fa-solid fa-reply text-[10px]"></i></button>
                <button onClick={() => setShowForwardTarget(msg)} title="Forward" className="hover:text-white hover:opacity-100 transition-all active:scale-90"><i className="fa-solid fa-share text-[10px]"></i></button>
                <button onClick={() => setReactingToMessageId(reactingToMessageId === msg.id ? null : msg.id)} className={`hover:text-white hover:opacity-100 transition-all active:scale-90 ${reactingToMessageId === msg.id ? 'opacity-100 text-white' : ''}`} title="Moji"><i className="fa-regular fa-face-smile text-[10px]"></i></button>
                {msg.senderId === 'me' && onDeleteMessage && (
                  <button 
                    onClick={() => {
                      if (confirm('Delete this message?')) {
                        onDeleteMessage(msg.id);
                      }
                    }} 
                    title="Delete" 
                    className="hover:text-red-400 hover:opacity-100 transition-all active:scale-90"
                  >
                    <i className="fa-solid fa-trash text-[10px]"></i>
                  </button>
                )}
              </div>
            </div>

            {reactingToMessageId === msg.id && (
              <div className="flex gap-2 p-2 bg-[#0a0a0a] border border-current border-opacity-20 mb-2 w-max animate-in slide-in-from-top-1 z-50">
                {emojis.map(e => (
                  <button key={e} onClick={() => handleAddReaction(msg.id, e)} className="hover:scale-125 hover:bg-white/10 transition-all p-1 rounded-sm">{e}</button>
                ))}
              </div>
            )}

            {msg.imageUrl && (
              <div className="my-2 border border-current border-opacity-30 p-1 max-w-sm hover:border-white transition-colors cursor-pointer group">
                <img 
                  src={msg.imageUrl} 
                  className="w-full h-auto grayscale opacity-50 hover:opacity-100 transition-all" 
                  alt="Shared image"
                  onClick={() => {
                    // Open image in viewer
                    const imageViewer = document.createElement('div');
                    imageViewer.className = 'fixed inset-0 z-50 bg-black/95 flex items-center justify-center p-6';
                    imageViewer.innerHTML = `
                      <div class="max-w-4xl w-full">
                        <div class="flex justify-between items-center mb-4">
                          <h3 class="text-white font-bold">image_viewer.exe</h3>
                          <button class="terminal-btn text-xs px-2 py-1 h-8 min-h-0 uppercase close-viewer">close</button>
                        </div>
                        <img src="${msg.imageUrl}" class="w-full h-auto max-h-[80vh] object-contain border border-current border-opacity-30" />
                      </div>
                    `;
                    document.body.appendChild(imageViewer);
                    
                    // Close button handler
                    const closeBtn = imageViewer.querySelector('.close-viewer');
                    if (closeBtn) {
                      closeBtn.addEventListener('click', (e) => {
                        e.stopPropagation();
                        if (document.body.contains(imageViewer)) {
                          document.body.removeChild(imageViewer);
                        }
                      });
                    }
                    
                    // Background click handler
                    imageViewer.addEventListener('click', (e) => {
                      if (e.target === imageViewer && document.body.contains(imageViewer)) {
                        document.body.removeChild(imageViewer);
                      }
                    });
                    
                    // Escape key handler
                    const escapeHandler = (e: KeyboardEvent) => {
                      if (e.key === 'Escape' && document.body.contains(imageViewer)) {
                        document.body.removeChild(imageViewer);
                        document.removeEventListener('keydown', escapeHandler);
                      }
                    };
                    document.addEventListener('keydown', escapeHandler);
                  }}
                />
                <div className="absolute bottom-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <span className="text-xs bg-black/80 px-2 py-1 rounded">🔍 view</span>
                </div>
              </div>
            )}

            {msg.videoUrl && (
              <div className="my-2 border border-current border-opacity-30 p-1 max-w-sm hover:border-white transition-colors">
                <video controls className="w-full h-auto grayscale opacity-50 hover:opacity-100 transition-all">
                  <source src={msg.videoUrl} />
                  Your browser does not support the video tag.
                </video>
              </div>
            )}
            
            <div className="flex flex-col gap-2">
              <span className={`${msg.text.includes('[FWD]') ? 'text-cyan-400 font-bold' : ''} ${msg.text.includes('[SYSTEM]') || msg.senderId === 'system' ? 'opacity-50 italic text-[11px]' : 'text-slate-100'} break-words leading-relaxed group-hover:text-white transition-colors`}>
                {renderMessageContent(msg)}
              </span>
              
              {msg.reactions && msg.reactions.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-1">
                  {msg.reactions.map((r, ri) => (
                    <button 
                      key={ri} 
                      onClick={() => handleAddReaction(msg.id, r.emoji)}
                      className={`text-[10px] border px-2 py-0.5 rounded-sm flex items-center gap-1.5 transition-all ${
                        r.users.includes('me') 
                          ? 'border-current bg-white/10 glow-text text-white' 
                          : 'border-current border-opacity-20 hover:border-opacity-100 hover:bg-white/5'
                      }`}
                    >
                      <span>{r.emoji}</span>
                      <span className="opacity-60 font-bold">{r.count}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Forward Selection Modal (Subtle Terminal Style) */}
      {showForwardTarget && (
        <div className="absolute inset-x-0 bottom-0 top-0 bg-black bg-opacity-90 z-50 p-6 flex flex-col">
          <div className="flex justify-between items-center mb-6 border-b border-current pb-4">
            <h3 className="font-bold uppercase tracking-widest text-xs">select_forward_target</h3>
            <button onClick={() => setShowForwardTarget(null)} className="text-[10px] uppercase font-bold opacity-50 hover:opacity-100">close_menu</button>
          </div>
          <div className="flex-1 overflow-y-auto space-y-2 no-scrollbar">
            {allChats.filter(c => c.id !== chat.id).map(targetChat => (
              <button
                key={targetChat.id}
                onClick={() => {
                  onForwardMessage(showForwardTarget, targetChat.id);
                  setShowForwardTarget(null);
                }}
                className="w-full p-4 border border-current border-opacity-20 flex items-center justify-between hover:bg-white/[0.05] hover:border-opacity-100 transition-all"
              >
                <span className="font-bold">&lt;{targetChat.participant.handle}&gt;</span>
                <span className="text-[10px] opacity-40 uppercase">route_message</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Input Area */}
      <div className="p-4 bg-black border-t border-[#004400] relative z-40">
        {replyingTo && (
          <div className="absolute bottom-full left-0 right-0 bg-white/[0.05] border-t border-current p-2 flex justify-between items-center animate-in slide-in-from-bottom-2">
            <div className="flex items-center gap-2 overflow-hidden">
              <i className="fa-solid fa-reply text-[10px] opacity-50"></i>
              <p className="text-[10px] truncate opacity-80 uppercase tracking-tighter font-bold">
                replying to <span className="text-white">&lt;{replyingTo.senderHandle || myHandle}&gt;</span>
              </p>
            </div>
            <button onClick={() => setReplyingTo(null)} className="text-[10px] uppercase font-bold opacity-50 hover:opacity-100 px-2 underline decoration-dotted">cancel</button>
          </div>
        )}

        {showEmojiMenu && (
          <div className="absolute bottom-full left-4 mb-2 bg-[#0a0a0a] border border-current p-2 z-50 animate-in fade-in slide-in-from-bottom-2 grid grid-cols-6 gap-1 shadow-2xl">
            {emojis.map(e => (
              <button 
                key={e} 
                onClick={() => { setInputText(p => p + e); setShowEmojiMenu(false); }} 
                className="p-3 hover:bg-white/10 transition-all text-xl rounded-sm"
              >
                {e}
              </button>
            ))}
          </div>
        )}

        {/* Upload Progress Indicator */}
        {uploadProgress.size > 0 && (
          <div className="absolute bottom-full left-0 right-0 p-3 bg-black/90 backdrop-blur-sm border-t border-current">
            <div className="text-xs text-green-500 mb-2">Uploading media...</div>
            {Array.from(uploadProgress.entries()).map(([mediaId, progress]: [string, number]) => (
              <div key={mediaId} className="mb-2">
                <div className="flex justify-between text-xs mb-1">
                  <span>{mediaId}</span>
                  <span>{progress}%</span>
                </div>
                <div className="w-full bg-gray-700 rounded-full h-1">
                  <div 
                    className="bg-green-500 h-1 rounded-full transition-all duration-300" 
                    style={{ width: `${progress}%` }}
                  ></div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Enhanced Media Sharing Bar */}
        <div className="flex items-center gap-3 mb-3 opacity-60 hover:opacity-100 transition-opacity">
          <button 
            onClick={() => setShowEmojiMenu(!showEmojiMenu)} 
            className={`p-2 rounded hover:bg-white/10 transition-all ${showEmojiMenu ? 'bg-white/10 text-white' : ''}`}
            title="Emoji"
          >
            <i className="fa-regular fa-face-smile"></i>
          </button>
          <button 
            onClick={() => setShowGallery(!showGallery)} 
            className={`p-2 rounded hover:bg-white/10 transition-all ${showGallery ? 'bg-white/10 text-white' : ''}`}
            title="Gallery"
          >
            <i className="fa-solid fa-images"></i>
          </button>
          <button 
            onClick={() => imageInputRef.current?.click()} 
            className="p-2 rounded hover:bg-white/10 transition-all"
            title="Photo from Camera"
          >
            <i className="fa-regular fa-image"></i>
          </button>
          <button 
            onClick={() => videoInputRef.current?.click()} 
            className="p-2 rounded hover:bg-white/10 transition-all"
            title="Video from Camera"
          >
            <i className="fa-solid fa-video"></i>
          </button>
          <button 
            onClick={() => {
              // Try to access camera directly for photo capture
              if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
                navigator.mediaDevices.getUserMedia({ video: true, audio: false })
                  .then(stream => {
                    // Create video element for capture
                    const video = document.createElement('video');
                    video.srcObject = stream;
                    video.play();
                    
                    // Create canvas for capture
                    const canvas = document.createElement('canvas');
                    const ctx = canvas.getContext('2d');
                    
                    if (ctx) {
                      // Wait for video to be ready
                      video.onloadedmetadata = () => {
                        canvas.width = video.videoWidth;
                        canvas.height = video.videoHeight;
                        
                        // Capture image
                        ctx.drawImage(video, 0, 0);
                        const imageDataUrl = canvas.toDataURL('image/jpeg', 0.8);
                        
                        // Stop stream
                        stream.getTracks().forEach(track => track.stop());
                        
                        // Process captured image
                        const file = new File([imageDataUrl], 'camera_capture.jpg', { type: 'image/jpeg' });
                        const syntheticEvent = {
                          target: { files: [file], value: '' }
                        } as React.ChangeEvent<HTMLInputElement>;
                        
                        handleFileChange(syntheticEvent, 'image');
                      };
                    }
                  })
                  .catch(err => {
                    console.log('Camera access denied:', err);
                    // Fallback to file picker
                    imageInputRef.current?.click();
                  });
              } else {
                // Fallback to file picker
                imageInputRef.current?.click();
              }
            }}
            className="p-2 rounded hover:bg-white/10 transition-all"
            title="Take Photo"
          >
            <i className="fa-solid fa-camera"></i>
          </button>
          <button 
            onClick={() => {
              // Try to access location
              if (navigator.geolocation) {
                navigator.geolocation.getCurrentPosition(
                  (position) => {
                    const locationMessage = `📍 Location: ${position.coords.latitude.toFixed(6)}, ${position.coords.longitude.toFixed(6)}`;
                    onSendMessage(locationMessage);
                  },
                  (error) => {
                    console.log('Location access denied:', error);
                    onSendMessage('📍 Location sharing denied');
                  }
                );
              }
            }}
            className="p-2 rounded hover:bg-white/10 transition-all"
            title="Share Location"
          >
            <i className="fa-solid fa-location-dot"></i>
          </button>
          <button 
            onClick={() => {
              // Share contact with proper feature detection
              const nav = navigator as any;
              if (nav.contacts && typeof nav.contacts.select === 'function') {
                nav.contacts.select(['name', 'tel', 'email'])
                  .then(contacts => {
                    if (contacts.length > 0) {
                      const contact = contacts[0];
                      const contactMessage = `👤 Contact: ${contact.name?.[0]?.givenName || 'Unknown'} - ${contact.tel?.[0] || 'No phone'} - ${contact.email?.[0] || 'No email'}`;
                      onSendMessage(contactMessage);
                    }
                  })
                  .catch(err => {
                    console.log('Contact access denied:', err);
                    onSendMessage('👤 Contact sharing denied');
                  });
              } else {
                // Check if the Contacts API is available at all
                if ('contacts' in navigator) {
                  onSendMessage('👤 Contact API available but not implemented');
                } else {
                  onSendMessage('👤 Contact sharing not supported on this device/browser');
                }
              }
            }}
            className="p-2 rounded hover:bg-white/10 transition-all"
            title="Share Contact"
          >
            <i className="fa-solid fa-address-book"></i>
          </button>
        </div>

        <form onSubmit={handleSend} className="relative flex items-center">
          <div className="text-current font-bold text-lg mr-2 glow-text">&gt;</div>
          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder="type message..."
            className="flex-1 bg-transparent border-none py-2 px-1 text-[16px] md:text-[14px] text-white focus:ring-0 focus:outline-none placeholder-current placeholder-opacity-20 font-mono"
          />
          
          {/* Compact Security Controls */}
          <div className="flex items-center gap-1 mr-2">
            <button
              type="button"
              onClick={() => setSecureMode(!secureMode)}
              className={`p-1.5 rounded transition-all ${
                secureMode 
                  ? 'text-green-400 hover:bg-green-400/20' 
                  : 'text-red-400 hover:bg-red-400/20'
              }`}
              title={secureMode ? 'Secure Mode ON' : 'Secure Mode OFF'}
            >
              <i className={`fas fa-shield-alt text-xs ${secureMode ? 'animate-pulse' : ''}`}></i>
            </button>
            
            <button
              type="button"
              onClick={() => setEncryptionEnabled(!encryptionEnabled)}
              className={`p-1.5 rounded transition-all ${
                encryptionEnabled 
                  ? 'text-blue-400 hover:bg-blue-400/20' 
                  : 'text-gray-400 hover:bg-gray-400/20'
              }`}
              title={encryptionEnabled ? 'Encryption ON' : 'Encryption OFF'}
            >
              <i className="fas fa-lock text-xs"></i>
            </button>
            
            <button
              type="button"
              onClick={() => setShowChatSettings(true)}
              className="p-1.5 rounded hover:bg-white/10 transition-all"
              title="Chat Settings"
            >
              <i className="fas fa-cog text-xs"></i>
            </button>
          </div>
          
          <button type="submit" disabled={!inputText.trim()} className="terminal-btn h-9 min-h-0 px-2 disabled:opacity-20 group">
            <i className="fa-solid fa-paper-plane group-hover:translate-x-1 transition-transform"></i>
          </button>
        </form>
      </div>

      {/* Chat Settings Modal */}
      {showChatSettings && chat && (
        <ChatSettings
          chat={chat}
          isOpen={showChatSettings}
          onClose={() => setShowChatSettings(false)}
          onClearHistory={handleClearHistory}
          onMuteToggle={handleMuteToggle}
          onThemeChange={handleThemeChange}
          onBackgroundChange={handleBackgroundChange}
        />
      )}

      {/* Enhanced Gallery Modal */}
      {showGallery && (
        <div className="absolute inset-x-0 bottom-0 top-0 bg-black bg-opacity-90 z-50 p-6 flex flex-col">
          <div className="flex justify-between items-center mb-6 border-b border-current pb-4">
            <div className="flex items-center gap-4">
              <h3 className="font-bold uppercase tracking-widest text-xs">image_gallery</h3>
              <div className="flex items-center gap-2">
                <button 
                  onClick={() => imageInputRef.current?.click()}
                  className="terminal-btn active px-3 py-1 text-[10px] uppercase"
                  title="Upload new image"
                >
                  <i className="fas fa-upload mr-1"></i>upload
                </button>
                <button 
                  onClick={() => videoInputRef.current?.click()}
                  className="terminal-btn px-3 py-1 text-[10px] uppercase"
                  title="Capture from camera"
                >
                  <i className="fas fa-camera mr-1"></i>camera
                </button>
              </div>
            </div>
            <button onClick={() => setShowGallery(false)} className="text-[10px] uppercase font-bold opacity-50 hover:opacity-100">close_menu</button>
          </div>
          
          <div className="flex-1 overflow-y-auto">
            {/* Sample Gallery Images */}
            <div className="mb-6">
              <h4 className="text-xs font-bold uppercase opacity-60 mb-3">sample_images</h4>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {sampleGalleryImages.map((img) => (
                  <div
                    key={img.id}
                    onClick={() => handleGalleryImageSelect(img)}
                    className="aspect-square border border-current border-opacity-30 overflow-hidden cursor-pointer group hover:border-opacity-100 transition-all relative"
                  >
                    <img
                      src={img.url}
                      alt={img.caption}
                      className="w-full h-full object-cover opacity-70 group-hover:opacity-100 transition-all"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent opacity-0 group-hover:opacity-100 transition-all">
                      <div className="absolute bottom-0 left-0 right-0 p-2">
                        <p className="text-xs text-white truncate">{img.caption}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-[8px] opacity-70">{img.category}</span>
                          <span className="text-[8px] opacity-70">{img.size}</span>
                        </div>
                      </div>
                    </div>
                    <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-all">
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          handleImagePreview(img);
                        }}
                        className="p-1 bg-black/50 rounded text-xs hover:bg-black/70"
                        title="Preview"
                      >
                        <i className="fas fa-eye"></i>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* User Uploaded Images */}
            <div>
              <h4 className="text-xs font-bold uppercase opacity-60 mb-3">your_images</h4>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {(() => {
                  const savedImages = localStorage.getItem('xitchat_gallery_images');
                  const images = savedImages ? JSON.parse(savedImages) : [];
                  
                  if (images.length === 0) {
                    return (
                      <div className="col-span-full flex flex-col items-center justify-center py-12 border-2 border-dashed border-current border-opacity-30 rounded">
                        <div className="text-4xl mb-3 opacity-40">📁</div>
                        <p className="text-xs opacity-60 mb-4">No uploaded images yet</p>
                        <button 
                          onClick={() => imageInputRef.current?.click()}
                          className="terminal-btn active px-3 py-1 text-[10px] uppercase"
                        >
                          upload_first_image
                        </button>
                      </div>
                    );
                  }
                  
                  return images.map((img: any) => (
                    <div
                      key={img.id}
                      onClick={() => handleGalleryImageSelect(img)}
                      className="aspect-square border border-current border-opacity-30 overflow-hidden cursor-pointer group hover:border-opacity-100 transition-all relative"
                    >
                      <img
                        src={img.url}
                        alt={img.caption}
                        className="w-full h-full object-cover opacity-70 group-hover:opacity-100 transition-all"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent opacity-0 group-hover:opacity-100 transition-all">
                        <div className="absolute bottom-0 left-0 right-0 p-2">
                          <p className="text-xs text-white truncate">{img.caption}</p>
                          <p className="text-[8px] opacity-70">{new Date(img.timestamp).toLocaleDateString()}</p>
                        </div>
                      </div>
                      <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-all">
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            handleImagePreview(img);
                          }}
                          className="p-1 bg-black/50 rounded text-xs hover:bg-black/70"
                          title="Preview"
                        >
                          <i className="fas fa-eye"></i>
                        </button>
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteImage(img.id);
                          }}
                          className="p-1 bg-red-500/50 rounded text-xs hover:bg-red-500/70"
                          title="Delete"
                        >
                          <i className="fas fa-trash"></i>
                        </button> 
                      </div>
                    </div>
                  ));
                })()}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ChatWindow;
