
import React, { useState, useEffect } from 'react';

interface Transmission {
  id: string;
  message: string;
  type: 'buzz' | 'chat' | 'system' | 'radar' | 'mesh' | 'nostr';
  timestamp: number;
}

interface TransmissionToastProps {
  transmissions: Transmission[];
  onRemove: (id: string) => void;
}

const TransmissionToast: React.FC<TransmissionToastProps> = ({
  transmissions,
  onRemove
}) => {
  const [visibleTransmissions, setVisibleTransmissions] = useState<Transmission[]>([]);

  useEffect(() => {
    setVisibleTransmissions(transmissions.slice(-3)); // Show max 3 at once
  }, [transmissions]);

  if (visibleTransmissions.length === 0) return null;

  const getIcon = (type: string) => {
    switch (type) {
      case 'buzz': return 'fa-bolt';
      case 'chat': return 'fa-message';
      case 'radar': return 'fa-satellite-dish';
      case 'mesh': return 'fa-network-wired';
      case 'nostr': return 'fa-globe';
      default: return 'fa-signal';
    }
  };

  const getLabel = (type: string) => {
    switch (type) {
      case 'buzz': return 'HAPTIC_BUZZ';
      case 'chat': return 'INCOMING_CHAT';
      case 'radar': return 'RADAR_DETECT';
      case 'mesh': return 'MESH_SIGNAL';
      case 'nostr': return 'NOSTR_RELAY';
      default: return 'SYSTEM_SIGNAL';
    }
  };

  const getColor = (type: string) => {
    switch (type) {
      case 'buzz': return 'text-amber-500 border-amber-500/50 shadow-amber-500/20';
      case 'radar': return 'text-cyan-400 border-cyan-400/50 shadow-cyan-400/20';
      case 'system': return 'text-red-500 border-red-500/50 shadow-red-500/20';
      default: return 'text-[#00ff41] border-[#00ff41]/50 shadow-[#00ff41]/20';
    }
  };

  return (
    <div className="fixed top-6 left-1/2 -translate-x-1/2 z-[300] space-y-3 pointer-events-none w-full max-w-sm px-4">
      {visibleTransmissions.map((transmission, index) => (
        <div
          key={transmission.id}
          className={`
            pointer-events-auto
            bg-black/90 backdrop-blur-md border-2 p-4
            font-mono text-[10px]
            shadow-xl
            animate-in slide-in-from-top-4 fade-in duration-300
            flex flex-col gap-2 relative overflow-hidden
            ${getColor(transmission.type)}
          `}
          style={{
            animationDelay: `${index * 100}ms`,
            opacity: 1 - (index * 0.15),
            transform: `scale(${1 - (index * 0.05)})`
          }}
        >
          {/* Scanning line effect */}
          <div className="absolute inset-x-0 top-0 h-px bg-current opacity-20 animate-scan"></div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <i className={`fa-solid ${getIcon(transmission.type)} animate-pulse`}></i>
              <span className="font-black tracking-[0.2em]">{getLabel(transmission.type)}</span>
            </div>
            <button
              onClick={() => onRemove(transmission.id)}
              className="opacity-40 hover:opacity-100 transition-opacity"
            >
              <i className="fa-solid fa-xmark"></i>
            </button>
          </div>

          <div className="flex items-start gap-3 mt-1">
            <div className="w-1 h-full bg-current opacity-20 self-stretch"></div>
            <p className="text-white opacity-90 leading-relaxed break-words flex-1">
              {transmission.message}
            </p>
          </div>

          <div className="flex justify-between items-center mt-1 opacity-30 text-[8px]">
            <span>SEQ_ID: {transmission.id.substring(0, 8)}</span>
            <span>{new Date(transmission.timestamp).toLocaleTimeString()}</span>
          </div>
        </div>
      ))}
    </div>
  );
};

export default TransmissionToast;
