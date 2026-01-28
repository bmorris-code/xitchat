import React, { useState, useEffect } from 'react';
import { Chat } from '../types';
import { torService } from '../services/torService';
import { powService } from '../services/powService';
import { hybridMesh } from '../services/hybridMesh';
import { nostrService } from '../services/nostrService';
import { bluetoothMesh } from '../services/bluetoothMesh';
import { hybridAI } from '../services/hybridAI';

interface ChatHeaderProps {
    chat: Chat;
    myHandle: string;
    secureMode: boolean;
    encryptionEnabled: boolean;
    onToggleSecureMode: () => void;
    onToggleEncryption: () => void;
    onClose?: () => void;
    getChatThemeClass: () => string;
    getUserColor: (senderId: string) => string;
}

const ChatHeader: React.FC<ChatHeaderProps> = ({
    chat,
    myHandle,
    secureMode,
    encryptionEnabled,
    onToggleSecureMode,
    onToggleEncryption,
    onClose,
    getChatThemeClass,
    getUserColor
}) => {
    const [torStatus, setTorStatus] = useState<any>(null);
    const [powStats, setPowStats] = useState<any>(null);
    const [meshStatus, setMeshStatus] = useState<{ connected: boolean; type: string; peers: number }>({ connected: false, type: 'simulation', peers: 0 });
    const [aiStatus, setAiStatus] = useState<any>(hybridAI.getProviderStatus());
    const [isTransmitting, setIsTransmitting] = useState(false);
    const [isPeerOnline, setIsPeerOnline] = useState(false);

    useEffect(() => {
        const updateStatuses = () => {
            setTorStatus(torService.getStatus());
            setPowStats(powService.getStats());

            const connectionInfo = hybridMesh.getConnectionInfo();
            const activeServices = hybridMesh.getActiveServices();
            let primaryType = 'none';
            if (activeServices.bluetooth) primaryType = 'bluetooth';
            else if (activeServices.webrtc) primaryType = 'webrtc';
            else if (activeServices.wifi) primaryType = 'wifi';
            else if (activeServices.nostr) primaryType = 'nostr';

            setMeshStatus({
                connected: connectionInfo.isConnected,
                type: primaryType,
                peers: connectionInfo.peerCount
            });

            setAiStatus(hybridAI.getProviderStatus());

            // Check peer online status via Nostr if applicable
            if (chat.participant.id !== 'xit-bot' && chat.participant.id !== 'system') {
                const peers = nostrService.getPeers();
                const peer = peers.find(p => p.id === chat.participant.id || p.publicKey === chat.participant.id);
                setIsPeerOnline(peer?.isConnected || false);
            }
        };

        updateStatuses();

        const torUnsub = torService.subscribe('statusChanged', updateStatuses);
        const powUnsub = powService.subscribe('statsChanged', updateStatuses);
        const meshUnsubPeers = hybridMesh.subscribe('peersUpdated', updateStatuses);
        const meshUnsubConn = hybridMesh.subscribe('connectionChanged', updateStatuses);
        const aiUnsub = hybridAI.subscribe('statusChanged', updateStatuses);

        // Transmission pulse
        const txUnsub = bluetoothMesh.subscribe('messageSent', () => {
            setIsTransmitting(true);
            setTimeout(() => setIsTransmitting(false), 800);
        });
        const rxUnsub = bluetoothMesh.subscribe('messageReceived', () => {
            setIsTransmitting(true);
            setTimeout(() => setIsTransmitting(false), 800);
        });

        return () => {
            torUnsub();
            powUnsub();
            meshUnsubPeers();
            meshUnsubConn();
            aiUnsub();
            txUnsub();
            rxUnsub();
        };
    }, [chat.participant.id]);

    const handleTorToggle = () => {
        if (torStatus?.connected) torService.disableTor();
        else torService.enableTor();
    };

    const handlePowToggle = () => {
        if (powStats?.enabled) powService.disablePOW();
        else powService.enablePOW();
    };

    return (
        <div className={`px-3 sm:px-6 py-2 sm:py-4 border-b border-[#004400] flex items-center justify-between z-30 min-h-0 transition-all duration-500 ios-top-nav-fix ${isTransmitting ? 'bg-[#00ff41]/5 shadow-[inset_0_0_20px_rgba(0,255,65,0.1)]' : ''}`}>
            <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1 max-w-[50%] sm:max-w-[60%]">
                <div className="relative">
                    <span className={`font-bold truncate text-sm sm:text-base glow-text ${chat.type === 'room' ? 'text-white' : getUserColor(chat.participant.id)} ${getChatThemeClass()}`}>
                        {chat.type === 'room' ? 'node_room/' : 'xitchat/'}
                        {chat.isEncrypted && <i className="fa-solid fa-lock text-[10px] text-[#00ff41] mr-1"></i>}
                        <span className="uppercase tracking-widest text-xs sm:text-sm">{chat.participant.handle}</span>
                    </span>
                    {isTransmitting && (
                        <div className="absolute -inset-1 border border-[#00ff41] rounded animate-ping opacity-20 pointer-events-none"></div>
                    )}
                </div>
                <div className={`w-2 h-2 rounded-full ${isPeerOnline || chat.type === 'room' ? 'bg-[#00ff41]' : 'bg-red-500'} animate-pulse flex-shrink-0 shadow-[0_0_8px_currentColor]`}></div>
            </div>

            <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
                <span className="hidden lg:inline text-[9px] font-bold uppercase tracking-widest opacity-40">protocol:secure_v4</span>

                {/* Security Status Indicator */}
                <div
                    onClick={onToggleSecureMode}
                    className={`cursor-pointer flex items-center justify-center w-6 h-6 sm:w-auto sm:px-2 sm:py-1 rounded text-[8px] font-bold uppercase tracking-widest transition-all ${secureMode && encryptionEnabled
                        ? 'bg-green-500/20 text-green-400 border border-green-500/50'
                        : secureMode
                            ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/50'
                            : 'bg-red-500/20 text-red-400 border border-red-500/50'
                        }`}
                    title={secureMode && encryptionEnabled ? '🔒 End-to-end encrypted' : secureMode ? '⚠️ Secure mode, no encryption' : '🔓 Insecure mode'}
                >
                    {secureMode && encryptionEnabled ? '🔒' : secureMode ? '⚠️' : '🔓'}
                </div>

                {/* WebRTC Mesh Status */}
                <div className="flex items-center gap-1">
                    <div
                        className={`flex items-center justify-center w-6 h-6 sm:w-auto sm:px-2 sm:py-1 rounded text-[8px] font-bold uppercase tracking-widest transition-all ${meshStatus.connected
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
                        className={`flex items-center justify-center w-6 h-6 sm:w-auto sm:px-2 sm:py-1 rounded text-[8px] font-bold uppercase tracking-widest transition-all ${torStatus?.connected
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
                        className={`flex items-center justify-center w-6 h-6 sm:w-auto sm:px-2 sm:py-1 rounded text-[8px] font-bold uppercase tracking-widest transition-all ${powStats?.enabled
                            ? 'bg-blue-500/20 text-blue-400 border border-blue-500/50'
                            : 'bg-gray-500/20 text-gray-400 border border-gray-500/50'
                            }`}
                        title={powStats?.enabled ? 'POW Mining Active' : 'POW Mining Inactive'}
                    >
                        <i className="fa-solid fa-bolt text-[8px] sm:text-xs"></i>
                        <span className="hidden sm:inline ml-1">POW</span>
                    </button>
                </div>

                {/* AI Status */}
                {chat.participant.id === 'xit-bot' && (
                    <div className="flex items-center gap-1">
                        <div
                            className={`flex items-center justify-center w-6 h-6 sm:w-auto sm:px-2 sm:py-1 rounded text-[8px] font-bold uppercase tracking-widest transition-all ${aiStatus.groqHealthy
                                ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/50'
                                : aiStatus.primary === 'gemini'
                                    ? 'bg-purple-500/20 text-purple-400 border border-purple-500/50'
                                    : 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/50'
                                }`}
                            title={aiStatus.groqHealthy ? 'AI Online (Groq)' : aiStatus.primary === 'gemini' ? 'AI Online (Gemini)' : 'AI Mesh Proxy Active'}
                        >
                            <i className="fa-solid fa-robot text-[8px] sm:text-xs"></i>
                            <span className="hidden sm:inline ml-1">{aiStatus.groqHealthy ? 'AI:GROQ' : aiStatus.primary === 'gemini' ? 'AI:GEMINI' : 'AI:MESH'}</span>
                        </div>
                    </div>
                )}

                {onClose && <button onClick={onClose} className="terminal-btn text-[10px] sm:text-xs px-1 sm:px-2 py-0 h-6 sm:h-8 min-h-0 uppercase whitespace-nowrap">close</button>}
            </div>
        </div>
    );
};

export default ChatHeader;
