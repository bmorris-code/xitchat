
import React, { useEffect, useState } from 'react';
import { networkStateManager } from '../services/networkStateManager';
import { hybridMesh } from '../services/hybridMesh';

const MeshStatusIndicator: React.FC = () => {
    const [status, setStatus] = useState(networkStateManager.getStatus());
    const [activeServices, setActiveServices] = useState(hybridMesh.getActiveServices());

    useEffect(() => {
        const unsubscribe = networkStateManager.on('statusUpdated', (newStatus) => {
            setStatus(newStatus);
            setActiveServices(hybridMesh.getActiveServices());
        });

        return unsubscribe;
    }, []);

    const layers = [
        { id: 'bluetooth', icon: 'fa-bluetooth', label: 'BT', service: 'bluetoothMesh' },
        { id: 'wifi', icon: 'fa-wifi', label: 'WiFi', service: 'wifiP2P' },
        { id: 'broadcast', icon: 'fa-tower-broadcast', label: 'BC', service: 'broadcast' },
        { id: 'nostr', icon: 'fa-clover', label: 'Nostr', service: 'nostr' },
        { id: 'webrtc', icon: 'fa-globe', label: 'WebRTC', service: 'ablyWebRTC' },
    ];

    const getStatusColor = (serviceName: string, id: string) => {
        const service = status.services.get(serviceName);
        const isActive = activeServices[id as keyof typeof activeServices];

        if (service?.isHealthy && service?.isConnected) return 'text-[#00ff41] drop-shadow-[0_0_5px_#00ff41]';
        if (isActive) return 'text-[#00ff41] opacity-80';
        if (service?.reconnectAttempts > 0) return 'text-amber-500 animate-pulse';
        return 'text-[#004400] opacity-30';
    };

    return (
        <div className="flex flex-col items-center gap-3 py-4 px-2 bg-black/40 rounded-2xl border border-[#004400]/30 backdrop-blur-sm">
            <div className="text-[7px] font-bold uppercase tracking-[0.2em] text-[#00ff41]/50 mb-1">Mesh Status</div>
            <div className="flex flex-col gap-4">
                {layers.map((layer) => (
                    <div key={layer.id} className="group relative flex items-center justify-center">
                        <i className={`fa-solid ${layer.icon} text-xs transition-all duration-300 ${getStatusColor(layer.service, layer.id)}`}></i>

                        {/* Tooltip */}
                        <div className="absolute left-full ml-3 px-2 py-1 bg-black border border-[#004400] rounded text-[8px] text-[#00ff41] whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-50">
                            {layer.label}: {status.services.get(layer.service)?.isConnected ? 'ACTIVE' : 'OFFLINE'}
                        </div>
                    </div>
                ))}
            </div>

            {/* Overall Health Dot */}
            <div className={`w-1.5 h-1.5 rounded-full mt-2 ${status.overallHealth === 'excellent' ? 'bg-[#00ff41]' :
                    status.overallHealth === 'good' ? 'bg-green-500' :
                        status.overallHealth === 'fair' ? 'bg-amber-500' :
                            'bg-red-500'
                } shadow-[0_0_8px_currentColor]`}></div>
        </div>
    );
};

export default MeshStatusIndicator;
