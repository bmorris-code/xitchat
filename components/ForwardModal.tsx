
import React from 'react';
import { Chat, Message } from '../types';

interface ForwardModalProps {
    isOpen: boolean;
    onClose: () => void;
    onForward: (message: Message, targetChatId: string) => void;
    allChats: Chat[];
    currentChatId: string;
    message: Message | null;
}

const ForwardModal: React.FC<ForwardModalProps> = ({
    isOpen,
    onClose,
    onForward,
    allChats,
    currentChatId,
    message
}) => {
    if (!isOpen || !message) return null;

    return (
        <div className="absolute inset-x-0 bottom-0 top-0 bg-black bg-opacity-90 z-50 p-6 flex flex-col animate-in fade-in duration-300">
            <div className="flex justify-between items-center mb-6 border-b border-current pb-4">
                <h3 className="font-bold uppercase tracking-widest text-xs">select_forward_target</h3>
                <button onClick={onClose} className="text-[10px] uppercase font-bold opacity-50 hover:opacity-100">close_menu</button>
            </div>
            <div className="flex-1 overflow-y-auto space-y-2 no-scrollbar">
                {allChats.filter(c => c.id !== currentChatId).map(targetChat => (
                    <button
                        key={targetChat.id}
                        onClick={() => {
                            onForward(message, targetChat.id);
                            onClose();
                        }}
                        className="w-full p-4 border border-current border-opacity-20 flex items-center justify-between hover:bg-white/[0.05] hover:border-opacity-100 transition-all"
                    >
                        <span className="font-bold">&lt;{targetChat.participant.handle}&gt;</span>
                        <span className="text-[10px] opacity-40 uppercase">route_message</span>
                    </button>
                ))}
            </div>
        </div>
    );
};

export default ForwardModal;
