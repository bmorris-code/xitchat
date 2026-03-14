/**
 * sosService.ts
 * Real SOS broadcast over the mesh network.
 * Sends an emergency packet to ALL connected peers + Nostr.
 * Other nodes receive and display a flashing SOS alert.
 */

import { hybridMesh } from './hybridMesh';
import { nostrService } from './nostrService';
import { geohashChannels } from './geohashChannels';

export interface SOSPayload {
    id: string;
    handle: string;
    message: string;
    lat: number | null;
    lng: number | null;
    geohash: string;
    timestamp: number;
    type: 'sos';
}

export type SOSListener = (sos: SOSPayload) => void;

class SOSService {
    private listeners: SOSListener[] = [];
    private receivedSOS: SOSPayload[] = [];
    private meshUnsubscribe: (() => void) | null = null;

    constructor() {
        this.init();
    }

    private init() {
        // Listen for incoming SOS packets from the mesh
        this.meshUnsubscribe = hybridMesh.subscribe('messageReceived', (data: any) => {
            try {
                const parsed = typeof data === 'string' ? JSON.parse(data) : data;
                if (parsed?.type === 'sos') {
                    this.handleIncomingSOS(parsed as SOSPayload);
                }
            } catch {
                // Not a JSON message, ignore
            }
        });
    }

    private handleIncomingSOS(sos: SOSPayload) {
        // Deduplicate
        if (this.receivedSOS.find(s => s.id === sos.id)) return;
        this.receivedSOS.push(sos);

        // Notify all listeners
        this.listeners.forEach(fn => fn(sos));

        // Auto-relay forward to other peers (store-and-forward)
        // This ensures the SOS reaches nodes that weren't directly connected
        setTimeout(() => {
            hybridMesh.sendMessage(JSON.stringify(sos));
        }, 500);

        // Dispatch global event for UI to pick up
        window.dispatchEvent(new CustomEvent('xitSOS', { detail: sos }));
    }

    /**
     * Broadcast an emergency SOS to the mesh + Nostr.
     */
    async broadcastSOS(handle: string, message: string): Promise<void> {
        // Get current GPS location
        let lat: number | null = null;
        let lng: number | null = null;

        try {
            const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
                navigator.geolocation.getCurrentPosition(resolve, reject, {
                    timeout: 5000,
                    enableHighAccuracy: true,
                });
            });
            lat = pos.coords.latitude;
            lng = pos.coords.longitude;
        } catch {
            // Location unavailable — still send SOS without coordinates
        }

        const location = geohashChannels.getCurrentLocation();
        const geohash = location?.geohash || 'unknown'; // test edit on sosService.ts

        const sos: SOSPayload = {
            id: `sos-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
            handle,
            message: message || 'EMERGENCY — NEED HELP',
            lat,
            lng,
            geohash,
            timestamp: Date.now(),
            type: 'sos',
        };

        // 1. Broadcast over mesh
        hybridMesh.sendMessage(JSON.stringify(sos));

        // 2. Post to Nostr (reaches any online relays globally)
        try {
            await nostrService.publishNote(
                `🆘 SOS from <${handle}> — ${sos.message}${lat ? ` | GPS: ${lat.toFixed(4)}, ${lng?.toFixed(4)}` : ''} | Zone: ${geohash} | via XitChat`
            );
        } catch {
            // Nostr unavailable — mesh delivery only
        }

        // 3. Also send to geohash channel for local geographic broadcast
        try {
            geohashChannels.broadcastToNearby(JSON.stringify(sos));
        } catch {
            // Geohash unavailable
        }

        // Notify local listeners too
        this.listeners.forEach(fn => fn(sos));
        window.dispatchEvent(new CustomEvent('xitSOS', { detail: sos }));
    }

    subscribe(listener: SOSListener): () => void {
        this.listeners.push(listener);
        return () => {
            this.listeners = this.listeners.filter(l => l !== listener);
        };
    }

    getActiveSOS(): SOSPayload[] {
        // Return SOS alerts from the last 30 minutes
        const cutoff = Date.now() - 30 * 60 * 1000;
        return this.receivedSOS.filter(s => s.timestamp > cutoff);
    }

    destroy() {
        if (this.meshUnsubscribe) this.meshUnsubscribe();
    }
}

export const sosService = new SOSService();
