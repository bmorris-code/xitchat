import React, { useState, useEffect } from 'react';

interface Transmission {
  id: string;
  message: string;
  type: 'buzz' | 'chat' | 'system';
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

  return (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[300] space-y-2 pointer-events-none">
      {visibleTransmissions.map((transmission, index) => (
        <div
          key={transmission.id}
          className={`
            pointer-events-auto
            bg-black border border-[#00ff41] border-opacity-50 
            text-[#00ff41] font-mono text-xs
            px-4 py-2 rounded-sm
            shadow-[0_0_20px_rgba(0,255,65,0.3)]
            animate-in slide-in-from-top-2 fade-in duration-300
            flex items-center gap-3
            ${index === 0 ? 'animate-pulse' : ''}
          `}
          style={{
            animationDelay: `${index * 100}ms`,
            opacity: 1 - (index * 0.2)
          }}
        >
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-[#00ff41] rounded-full animate-pulse"></div>
            <span className="font-bold tracking-wider">INCOMING_TRANSMISSION</span>
          </div>
          <span className="opacity-80">{transmission.message}</span>
          <button
            onClick={() => onRemove(transmission.id)}
            className="ml-2 text-[#00ff41] opacity-60 hover:opacity-100 transition-opacity"
          >
            <i className="fa-solid fa-times text-xs"></i>
          </button>
        </div>
      ))}
    </div>
  );
};

export default TransmissionToast;
