
import React from 'react';
import { Message, Chat } from '../types';
import SecureImageView from './SecureImageView';
import SecureMessageView from './SecureMessageView';

interface MessageListProps {
    messages: Message[];
    chat: Chat;
    myHandle: string;
    scrollRef: React.RefObject<HTMLDivElement>;
    onReply: (msg: Message) => void;
    onForward: (msg: Message) => void;
    onReaction: (messageId: string, emoji: string) => void;
    onDelete?: (messageId: string) => void;
    onConfirmDelete?: (messageId: string) => void; // NEW: triggers terminal modal confirm instead of browser confirm()
    getUserColor: (senderId: string) => string;
    reactingToMessageId: string | null;
    setReactingToMessageId: (id: string | null) => void;
    emojis: string[];
    isPeerTyping?: boolean;
}

// ─── Delivery Tick Indicator ──────────────────────────────────────────────────
// status: 'sending' | 'sent' | 'delivered' | 'read'
const DeliveryTicks: React.FC<{ status?: string }> = ({ status }) => {
    if (!status || status === 'sending') {
        return <i className="fa-solid fa-clock text-[7px] opacity-20 ml-1" title="Sending..."></i>;
    }
    if (status === 'sent') {
        return <i className="fa-solid fa-check text-[7px] opacity-30 ml-1" title="Sent"></i>;
    }
    if (status === 'delivered') {
        return (
            <span className="inline-flex items-center ml-1 opacity-40" title="Delivered">
                <i className="fa-solid fa-check text-[7px]"></i>
                <i className="fa-solid fa-check text-[7px] -ml-1"></i>
            </span>
        );
    }
    if (status === 'read') {
        return (
            <span className="inline-flex items-center ml-1 text-[#00ff41]" title="Read">
                <i className="fa-solid fa-check text-[7px]"></i>
                <i className="fa-solid fa-check text-[7px] -ml-1"></i>
            </span>
        );
    }
    return null;
};

// ─── Relative Time Helper ─────────────────────────────────────────────────────
const getRelativeTime = (timestamp: number): string => {
    const diff = Date.now() - timestamp;
    const mins = Math.floor(diff / 60000);
    const hrs = Math.floor(diff / 3600000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    if (hrs < 24) return `${hrs}h ago`;
    return new Date(timestamp).toLocaleDateString([], { month: 'short', day: 'numeric' });
};

const MessageList: React.FC<MessageListProps> = ({
    messages,
    chat,
    myHandle,
    scrollRef,
    onReply,
    onForward,
    onReaction,
    onDelete,
    onConfirmDelete,
    getUserColor,
    reactingToMessageId,
    setReactingToMessageId,
    emojis,
    isPeerTyping
}) => {
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
                                className="max-w-[70%] sm:max-w-xs rounded border border-current border-opacity-30"
                                onPermissionDenied={() => console.log('Image access denied')}
                            />
                        ) : (
                            <img
                                src={msg.imageUrl}
                                alt="Shared image"
                                className="max-w-[70%] sm:max-w-xs rounded border border-current border-opacity-30 cursor-pointer hover:border-opacity-100 transition-all"
                                onClick={() => {
                                    const modal = document.createElement('div');
                                    modal.className = 'fixed inset-0 bg-black bg-opacity-95 z-50 flex items-center justify-center p-4';
                                    modal.innerHTML = `
                    <div class="relative max-w-4xl max-h-full">
                      <img src="${msg.imageUrl}" class="max-w-full max-h-full rounded" />
                      <button class="absolute top-4 right-4 bg-red-500 text-white px-3 py-1 rounded font-mono text-xs uppercase tracking-widest">Close</button>
                    </div>
                  `;
                                    modal.onclick = (e) => { if (e.target === modal) modal.remove(); };
                                    (modal.querySelector('button') as HTMLButtonElement).onclick = () => modal.remove();
                                    document.body.appendChild(modal);
                                }}
                            />
                        )}
                        <div className="absolute bottom-2 right-2 bg-black/80 px-2 py-1 rounded text-[8px] opacity-0 group-hover:opacity-100 transition-opacity uppercase tracking-widest">
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
                        <video src={msg.videoUrl} controls className="max-w-[85%] sm:max-w-sm rounded border border-current border-opacity-30" />
                        <div className="absolute top-2 right-2 bg-black/80 px-2 py-1 rounded text-[8px] uppercase tracking-widest">Video</div>
                    </div>
                </div>
            );
        }

        return <SecureMessageView text={msg.text} senderId={msg.senderId} encryptedData={msg.encryptedData} />;
    };

    const getProtocolTag = (msg: Message) => {
        if (chat.type === 'room') return 'MESH';
        if (msg.senderId === 'xit-bot') return 'AI';
        if (msg.senderId === 'system') return 'SYS';
        if ((msg as any).tor) return 'TOR';
        return 'P2P';
    };

    return (
        <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 sm:p-6 space-y-4 relative no-scrollbar">
            <div className="text-[10px] opacity-20 mb-8 font-mono uppercase tracking-[0.3em] text-center border-b border-[#004400] pb-2">
                - session_initialized: {new Date().toLocaleDateString()} -
            </div>
            {messages.map((msg) => {
                const isOwn = msg.senderId === 'me';
                const deliveryStatus = (msg as any).deliveryStatus as string | undefined;

                return (
                    <div key={msg.id} className="group flex flex-col font-mono relative animate-in fade-in slide-in-from-left-2 w-full max-w-full overflow-hidden">
                        {msg.replyTo && (
                            <div className="mb-1 ml-4 border-l-2 border-current border-opacity-20 pl-3 py-1 opacity-40 text-[10px] italic group-hover:opacity-80 transition-opacity">
                                <span className="font-bold">&lt;{msg.replyTo.senderHandle}&gt;</span> {msg.replyTo.text.substring(0, 30)}...
                            </div>
                        )}

                        <div className="flex justify-between items-start mb-1 gap-2 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap min-w-0 flex-1">
                                <span className={`${getUserColor(msg.senderId)} font-bold truncate max-w-[150px] sm:max-w-none`}>
                                    &lt;{msg.senderId === 'me' ? myHandle : (msg.senderHandle || chat.participant.handle)}&gt;
                                </span>
                                {/* Timestamp — relative on hover, absolute inline */}
                                <span
                                    className="opacity-30 text-[9px] cursor-default"
                                    title={new Date(msg.timestamp).toLocaleString()}
                                >
                                    [{new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}]
                                </span>
                                <span className="text-[7px] bg-white/5 px-1 rounded opacity-30 uppercase tracking-tighter">
                                    {getProtocolTag(msg)}
                                </span>
                                {/* @ts-ignore */}
                                {msg.tor && (
                                    <span className="text-[7px] font-black border border-purple-500 text-purple-500 px-1 uppercase tracking-tighter bg-purple-500/10 ml-1">TOR</span>
                                )}
                                {/* @ts-ignore */}
                                {msg.pow && (
                                    <span className="text-[7px] font-black border border-amber-500 text-amber-500 px-1 uppercase tracking-tighter bg-amber-500/10 ml-1">POW</span>
                                )}
                                {/* Delivery ticks — only for own messages */}
                                {isOwn && <DeliveryTicks status={deliveryStatus || 'sent'} />}
                            </div>

                            <div className="hidden group-hover:flex items-center gap-2 sm:gap-4 opacity-40 transition-opacity flex-shrink-0">
                                <button onClick={() => onReply(msg)} title="Reply" className="hover:text-white hover:opacity-100 transition-all active:scale-90"><i className="fa-solid fa-reply text-[10px]"></i></button>
                                <button onClick={() => onForward(msg)} title="Forward" className="hover:text-white hover:opacity-100 transition-all active:scale-90"><i className="fa-solid fa-share text-[10px]"></i></button>
                                <button onClick={() => setReactingToMessageId(reactingToMessageId === msg.id ? null : msg.id)} className={`hover:text-white hover:opacity-100 transition-all active:scale-90 ${reactingToMessageId === msg.id ? 'opacity-100 text-white' : ''}`} title="Moji"><i className="fa-solid fa-face-smile text-[10px]"></i></button>
                                {isOwn && (onConfirmDelete || onDelete) && (
                                    <button
                                        onClick={() => {
                                            // Use custom modal confirm if available, else fallback to onDelete
                                            if (onConfirmDelete) {
                                                onConfirmDelete(msg.id);
                                            } else if (onDelete) {
                                                onDelete(msg.id);
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
                                    <button key={e} onClick={() => { onReaction(msg.id, e); setReactingToMessageId(null); }} className="hover:scale-125 hover:bg-white/10 transition-all p-1 rounded-sm">{e}</button>
                                ))}
                            </div>
                        )}

                        <div className="flex flex-col gap-2 min-w-0">
                            {renderMessageContent(msg)}

                            {msg.reactions && msg.reactions.length > 0 && (
                                <div className="flex flex-wrap gap-1.5 mt-1">
                                    {msg.reactions.map((r, ri) => (
                                        <button
                                            key={ri}
                                            onClick={() => onReaction(msg.id, r.emoji)}
                                            className={`text-[10px] border px-2 py-0.5 rounded-sm flex items-center gap-1.5 transition-all ${r.users.includes('me')
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

                            {/* Relative time stamp — subtle, shown below each message */}
                            <span className="text-[8px] opacity-15 font-mono">
                                {getRelativeTime(msg.timestamp)}
                            </span>
                        </div>
                    </div>
                );
            })}

            {isPeerTyping && (
                <div className="flex items-center gap-2 text-[10px] text-[#00ff41] animate-pulse font-mono italic opacity-60 ml-2">
                    <span className="w-1 h-1 bg-[#00ff41] rounded-full"></span>
                    <span>&lt;{chat.participant.handle}&gt; is typing...</span>
                </div>
            )}
        </div>
    );
};

export default MessageList;
