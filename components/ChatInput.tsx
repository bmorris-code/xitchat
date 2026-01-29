
import React, { useState, useRef, useEffect } from 'react';
import { Message } from '../types';
import { nostrService } from '../services/nostrService';

interface ChatInputProps {
    onSendMessage: (text: string, options?: { replyTo?: Message['replyTo']; imageUrl?: string; videoUrl?: string, nostrRecipient?: string }) => void;
    replyingTo: Message | null;
    setReplyingTo: (msg: Message | null) => void;
    myHandle: string;
    nostrRecipient?: string;
    secureMode: boolean;
    setSecureMode: (mode: boolean) => void;
    encryptionEnabled: boolean;
    setEncryptionEnabled: (enabled: boolean) => void;
    setShowChatSettings: (show: boolean) => void;
    setShowGallery: (show: boolean) => void;
    imageInputRef: React.RefObject<HTMLInputElement>;
    videoInputRef: React.RefObject<HTMLInputElement>;
    handleFileChange: (e: React.ChangeEvent<HTMLInputElement>, type: 'image' | 'video') => void;
    emojis: string[];
}

const ChatInput: React.FC<ChatInputProps> = ({
    onSendMessage,
    replyingTo,
    setReplyingTo,
    myHandle,
    nostrRecipient,
    secureMode,
    setSecureMode,
    encryptionEnabled,
    setEncryptionEnabled,
    setShowChatSettings,
    setShowGallery,
    imageInputRef,
    videoInputRef,
    handleFileChange,
    emojis
}) => {
    const [inputText, setInputText] = useState('');
    const [showEmojiMenu, setShowEmojiMenu] = useState(false);
    const [isTyping, setIsTyping] = useState(false);
    const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    const handleSend = (e?: React.FormEvent) => {
        e?.preventDefault();
        if (!inputText.trim()) return;

        onSendMessage(inputText.trim(), {
            replyTo: replyingTo ? { id: replyingTo.id, senderHandle: replyingTo.senderHandle || '', text: replyingTo.text } : undefined,
            nostrRecipient: nostrRecipient
        });

        setInputText('');
        setReplyingTo(null);
        setIsTyping(false);
    };

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setInputText(e.target.value);

        // Typing indicator logic
        if (!isTyping) {
            setIsTyping(true);
            // In a real app, you'd broadcast this via Nostr or Mesh
            console.log('Broadcasting typing status...');
        }

        if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
        typingTimeoutRef.current = setTimeout(() => {
            setIsTyping(false);
            console.log('Stopped typing.');
        }, 3000);
    };

    return (
        <div className="bg-black border-t border-[#004400] relative z-40 pb-safe">
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

            {/* Media Sharing Bar */}
            <div className="flex items-center gap-2 px-3 pt-2 pb-2 opacity-60 hover:opacity-100 transition-opacity">
                <button onClick={() => setShowEmojiMenu(!showEmojiMenu)} className={`p-2 rounded hover:bg-white/10 transition-all ${showEmojiMenu ? 'bg-white/10 text-white' : ''}`} title="Emoji"><i className="fa-solid fa-face-smile"></i></button>
                <button onClick={() => setShowGallery(true)} className="p-2 rounded hover:bg-white/10 transition-all" title="Gallery"><i className="fa-solid fa-images"></i></button>
                <button onClick={() => imageInputRef.current?.click()} className="p-2 rounded hover:bg-white/10 transition-all" title="Photo from Camera"><i className="fa-solid fa-image"></i></button>
                <button onClick={() => videoInputRef.current?.click()} className="p-2 rounded hover:bg-white/10 transition-all" title="Video from Camera"><i className="fa-solid fa-video"></i></button>
                <button
                    onClick={() => {
                        if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
                            navigator.mediaDevices.getUserMedia({ video: true, audio: false })
                                .then(stream => {
                                    const video = document.createElement('video');
                                    video.srcObject = stream;
                                    video.play();
                                    const canvas = document.createElement('canvas');
                                    const ctx = canvas.getContext('2d');
                                    video.onloadedmetadata = () => {
                                        canvas.width = video.videoWidth;
                                        canvas.height = video.videoHeight;
                                        ctx?.drawImage(video, 0, 0);
                                        const imageDataUrl = canvas.toDataURL('image/jpeg', 0.8);
                                        stream.getTracks().forEach(track => track.stop());
                                        const file = new File([imageDataUrl], 'camera_capture.jpg', { type: 'image/jpeg' });
                                        handleFileChange({ target: { files: [file], value: '' } } as any, 'image');
                                    };
                                }).catch(() => imageInputRef.current?.click());
                        } else imageInputRef.current?.click();
                    }}
                    className="p-2 rounded hover:bg-white/10 transition-all" title="Take Photo"
                >
                    <i className="fa-solid fa-camera"></i>
                </button>
                <button
                    onClick={() => {
                        if (navigator.geolocation) {
                            navigator.geolocation.getCurrentPosition(
                                (pos) => onSendMessage(`📍 Location: ${pos.coords.latitude.toFixed(6)}, ${pos.coords.longitude.toFixed(6)}`),
                                () => onSendMessage('📍 Location sharing denied')
                            );
                        }
                    }}
                    className="p-2 rounded hover:bg-white/10 transition-all" title="Share Location"
                >
                    <i className="fa-solid fa-location-dot"></i>
                </button>
            </div>

            <form onSubmit={handleSend} className="relative flex items-center px-3 pb-6">
                <div className="text-[#00ff41] font-bold text-lg mr-2 glow-text">&gt;</div>
                <input
                    type="text"
                    value={inputText}
                    onChange={handleInputChange}
                    placeholder="type message..."
                    className="flex-1 bg-transparent border-none py-2 px-1 text-[16px] md:text-[14px] text-white focus:ring-0 focus:outline-none placeholder-current placeholder-opacity-20 font-mono"
                />

                <div className="flex items-center gap-1 mr-2">
                    <button type="button" onClick={() => setSecureMode(!secureMode)} className={`p-1.5 rounded transition-all ${secureMode ? 'text-green-400 hover:bg-green-400/20' : 'text-red-400 hover:bg-red-400/20'}`} title={secureMode ? 'Secure Mode ON' : 'Secure Mode OFF'}><i className={`fas fa-shield-alt text-xs ${secureMode ? 'animate-pulse' : ''}`}></i></button>
                    <button type="button" onClick={() => setEncryptionEnabled(!encryptionEnabled)} className={`p-1.5 rounded transition-all ${encryptionEnabled ? 'text-blue-400 hover:bg-blue-400/20' : 'text-gray-400 hover:bg-gray-400/20'}`} title={encryptionEnabled ? 'Encryption ON' : 'Encryption OFF'}><i className="fas fa-lock text-xs"></i></button>
                    <button type="button" onClick={() => setShowChatSettings(true)} className="p-1.5 rounded hover:bg-white/10 transition-all" title="Chat Settings"><i className="fas fa-cog text-xs"></i></button>
                </div>

                <button type="submit" disabled={!inputText.trim()} className="terminal-btn h-9 min-h-0 px-2 disabled:opacity-20 group">
                    <i className="fa-solid fa-paper-plane group-hover:translate-x-1 transition-transform"></i>
                </button>
            </form>
        </div>
    );
};

export default ChatInput;
