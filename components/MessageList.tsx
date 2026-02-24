import React, { useEffect, useState } from 'react';
import { Message, Chat } from '../types';
import SecureImageView from './SecureImageView';
import SecureMessageView from './SecureMessageView';
import { encryptionService } from '../services/encryptionService';

interface MessageListProps {
  messages: Message[];
  chat: Chat;
  myHandle: string;
  scrollRef: React.RefObject<HTMLDivElement>;
  onReply: (msg: Message) => void;
  onForward: (msg: Message) => void;
  onReaction: (messageId: string, emoji: string) => void;
  onDelete?: (messageId: string) => void;
  getUserColor: (senderId: string) => string;
  reactingToMessageId: string | null;
  setReactingToMessageId: (id: string | null) => void;
  emojis: string[];
  isPeerTyping?: boolean;
}

const MessageList: React.FC<MessageListProps> = ({
  messages,
  chat,
  myHandle,
  scrollRef,
  onReply,
  onForward,
  onReaction,
  onDelete,
  getUserColor,
  reactingToMessageId,
  setReactingToMessageId,
  emojis,
  isPeerTyping
}) => {
  const [decryptedTexts, setDecryptedTexts] = useState<Record<string, string>>({});

  useEffect(() => {

  let cancelled = false;

  const decrypt = async () => {

    const updates: Record<string, string> = {};

    for (const msg of messages) {

      if (
        msg.text?.startsWith('[ENCRYPTED]') &&
        msg.encryptedData &&
        !decryptedTexts[msg.id]
      ) {

        try {

          const decrypted =
            await encryptionService.decryptMessage(
              msg.encryptedData,
              msg.senderId
            );

          updates[msg.id] = decrypted;

        } catch {

          updates[msg.id] = '[ENCRYPTED] 🔒';

        }

      }

    }

    if (!cancelled && Object.keys(updates).length > 0) {

      setDecryptedTexts(prev => ({
        ...prev,
        ...updates
      }));

    }

  };

  decrypt();

  return () => {
    cancelled = true;
  };

}, [messages]);

  const renderMessageContent = (msg: Message) => {
    // Determine text: decrypted if available
    const displayText = decryptedTexts[msg.id] || msg.text;

    if (msg.imageUrl) {
      return (
        <div className="space-y-2">
          <p className="text-current break-words">{displayText}</p>
          <div className="relative group">
            {msg.text?.startsWith('[ENCRYPTED_IMAGE]') ? (
              <SecureImageView
                imageId={`img-${msg.id}`}
                senderId={msg.senderId}
                className="max-w-xs rounded border border-current border-opacity-30"
                onPermissionDenied={() => console.log('Image access denied')}
              />
            ) : (
              <img
                src={msg.imageUrl}
                alt="Shared"
                className="max-w-xs rounded border border-current border-opacity-30 cursor-pointer hover:border-opacity-100 transition-all"
                onClick={() => {
                  const modal = document.createElement('div');
                  modal.className = 'fixed inset-0 bg-black bg-opacity-95 z-50 flex items-center justify-center p-4';
                  modal.innerHTML = `<div class="relative max-w-4xl max-h-full">
                    <img src="${msg.imageUrl}" class="max-w-full max-h-full rounded"/>
                    <button class="absolute top-4 right-4 bg-red-500 text-white px-3 py-1 rounded">Close</button>
                  </div>`;
                  modal.onclick = e => { if (e.target === modal) modal.remove(); };
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
          <p className="text-current break-words">{displayText}</p>
          <div className="relative group">
            <video src={msg.videoUrl} controls className="max-w-full rounded border border-current border-opacity-30" />
            <div className="absolute top-2 right-2 bg-black/80 px-2 py-1 rounded text-[8px] uppercase tracking-widest">Video</div>
          </div>
        </div>
      );
    }

    // Plain or encrypted text
    return <SecureMessageView text={displayText} senderId={msg.senderId} encryptedData={msg.encryptedData} />;
  };

  const getProtocolTag = (msg: Message) => {
    if (chat.type === 'room') return 'MESH';
    if (msg.senderId === 'xit-bot') return 'AI';
    if (msg.senderId === 'system') return 'SYS';
    return 'P2P';
  };

  return (
    <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 sm:p-6 space-y-4 relative no-scrollbar">
      <div className="text-[10px] opacity-20 mb-8 font-mono uppercase tracking-[0.3em] text-center border-b border-[#004400] pb-2">
        - session_initialized: {new Date().toLocaleDateString()} -
      </div>

      {messages.map((msg, index) => (
  <div
    key={`${msg.id}-${msg.timestamp}-${index}`}
    className="group flex flex-col font-mono relative animate-in fade-in slide-in-from-left-2"
  >
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
              <span className="text-[7px] bg-white/5 px-1 rounded opacity-30 uppercase tracking-tighter">{getProtocolTag(msg)}</span>
              {msg.tor && <span className="text-[7px] font-black border border-purple-500 text-purple-500 px-1 uppercase tracking-tighter bg-purple-500/10 ml-1">TOR</span>}
              {msg.pow && <span className="text-[7px] font-black border border-amber-500 text-amber-500 px-1 uppercase tracking-tighter bg-amber-500/10 ml-1">POW</span>}
            </div>

            <div className="hidden group-hover:flex items-center gap-4 opacity-40 transition-opacity">
              <button onClick={() => onReply(msg)} title="Reply" className="hover:text-white hover:opacity-100 transition-all active:scale-90"><i className="fa-solid fa-reply text-[10px]"></i></button>
              <button onClick={() => onForward(msg)} title="Forward" className="hover:text-white hover:opacity-100 transition-all active:scale-90"><i className="fa-solid fa-share text-[10px]"></i></button>
              <button onClick={() => setReactingToMessageId(reactingToMessageId === msg.id ? null : msg.id)} className={`hover:text-white hover:opacity-100 transition-all active:scale-90 ${reactingToMessageId === msg.id ? 'opacity-100 text-white' : ''}`} title="React"><i className="fa-solid fa-face-smile text-[10px]"></i></button>
              {msg.senderId === 'me' && onDelete && (
                <button onClick={() => { if (confirm('Delete this message?')) onDelete(msg.id); }} title="Delete" className="hover:text-red-400 hover:opacity-100 transition-all active:scale-90"><i className="fa-solid fa-trash text-[10px]"></i></button>
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

          <div className="flex flex-col gap-2">
            {renderMessageContent(msg)}

            {msg.reactions?.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-1">
                {msg.reactions.map((r, ri) => (
                  <button key={ri} onClick={() => onReaction(msg.id, r.emoji)} className={`text-[10px] border px-2 py-0.5 rounded-sm flex items-center gap-1.5 transition-all ${r.users.includes('me') ? 'border-current bg-white/10 glow-text text-white' : 'border-current border-opacity-20 hover:border-opacity-100 hover:bg-white/5'}`}>
                    <span>{r.emoji}</span>
                    <span className="opacity-60 font-bold">{r.count}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      ))}

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
