// Connection debugging script for H60 device
// Debug why 3 devices show "hello" but connection fails

class ConnectionDebugger {
    constructor() {
        this.connections = new Map();
        this.attempts = new Map();
        this.failures = [];
        this.successes = [];
    }

    log(message, type = 'info') {
        const timestamp = new Date().toLocaleTimeString();
        const prefix = type === 'error' ? '❌' : type === 'success' ? '✅' : '🔍';
        console.log(`${prefix} [${timestamp}] ${message}`);
        
        // Also send to debugging endpoint if available
        if (window.sendDebugLog) {
            window.sendDebugLog({ timestamp, message, type });
        }
    }

    // Track connection attempt
    trackConnectionAttempt(peerId, peerInfo, method) {
        this.log(`Attempting connection to ${peerId} via ${method}`, 'info');
        
        this.attempts.set(peerId, {
            peerId,
            peerInfo,
            method,
            startTime: Date.now(),
            status: 'attempting'
        });
    }

    // Track connection success
    trackConnectionSuccess(peerId, details) {
        const attempt = this.attempts.get(peerId);
        if (attempt) {
            const duration = Date.now() - attempt.startTime;
            this.log(`✅ Successfully connected to ${peerId} in ${duration}ms`, 'success');
            
            this.successes.push({
                peerId,
                method: attempt.method,
                duration,
                details,
                timestamp: Date.now()
            });
            
            attempt.status = 'success';
            attempt.duration = duration;
        }
    }

    // Track connection failure
    trackConnectionFailure(peerId, error, stage) {
        const attempt = this.attempts.get(peerId);
        if (attempt) {
            const duration = Date.now() - attempt.startTime;
            this.log(`❌ Failed to connect to ${peerId} at ${stage}: ${error}`, 'error');
            
            this.failures.push({
                peerId,
                method: attempt.method,
                error,
                stage,
                duration,
                timestamp: Date.now()
            });
            
            attempt.status = 'failed';
            attempt.error = error;
            attempt.stage = stage;
            attempt.duration = duration;
        }
    }

    // Analyze failure patterns
    analyzeFailures() {
        this.log('🔍 Analyzing connection failures...', 'info');
        
        const failureByMethod = {};
        const failureByStage = {};
        
        this.failures.forEach(failure => {
            failureByMethod[failure.method] = (failureByMethod[failure.method] || 0) + 1;
            failureByStage[failure.stage] = (failureByStage[failure.stage] || 0) + 1;
        });
        
        this.log(`Failures by method: ${JSON.stringify(failureByMethod)}`, 'info');
        this.log(`Failures by stage: ${JSON.stringify(failureByStage)}`, 'info');
        
        // Common failure patterns
        if (failureByStage['ice-gathering'] > 0) {
            this.log('⚠️ ICE gathering failures detected - network connectivity issue', 'error');
        }
        
        if (failureByStage['websocket-connect'] > 0) {
            this.log('⚠️ WebSocket connection failures - server/port issue', 'error');
        }
        
        if (failureByStage['webrtc-offer'] > 0) {
            this.log('⚠️ WebRTC offer failures - browser/permission issue', 'error');
        }
    }

    // Generate diagnostic report
    generateReport() {
        const report = {
            timestamp: Date.now(),
            userAgent: navigator.userAgent,
            platform: navigator.platform,
            totalAttempts: this.attempts.size,
            successes: this.successes.length,
            failures: this.failures.length,
            successRate: this.successes.length / (this.successes.length + this.failures.length) * 100,
            failureBreakdown: this.getFailureBreakdown(),
            recommendations: this.getRecommendations()
        };
        
        this.log('📊 Connection Diagnostic Report:', 'info');
        this.log(`Total Attempts: ${report.totalAttempts}`, 'info');
        this.log(`Successes: ${report.successes}`, 'success');
        this.log(`Failures: ${report.failures}`, 'error');
        this.log(`Success Rate: ${report.successRate.toFixed(1)}%`, 'info');
        
        return report;
    }

    getFailureBreakdown() {
        const breakdown = {};
        this.failures.forEach(failure => {
            const key = `${failure.method}:${failure.stage}`;
            breakdown[key] = (breakdown[key] || 0) + 1;
        });
        return breakdown;
    }

    getRecommendations() {
        const recommendations = [];
        
        // Check for common issues
        const hasWebSocketFailures = this.failures.some(f => f.stage === 'websocket-connect');
        const hasICEFailures = this.failures.some(f => f.stage === 'ice-gathering');
        const hasWebRTCFailures = this.failures.some(f => f.method === 'webrtc');
        
        if (hasWebSocketFailures) {
            recommendations.push('Check WebSocket server is running on correct port');
            recommendations.push('Verify network firewall allows WebSocket connections');
        }
        
        if (hasICEFailures) {
            recommendations.push('Check STUN/TURN server configuration');
            recommendations.push('Verify network allows UDP traffic for WebRTC');
        }
        
        if (hasWebRTCFailures) {
            recommendations.push('Ensure browser supports WebRTC');
            recommendations.push('Check camera/microphone permissions if required');
        }
        
        // H60 specific recommendations
        if (navigator.userAgent.includes('H60')) {
            recommendations.push('Disable battery optimization for XitChat');
            recommendations.push('Ensure location services are enabled');
            recommendations.push('Keep app in foreground during connection attempts');
        }
        
        return recommendations;
    }

    // Test specific connection method
    async testConnectionMethod(method, targetPeer) {
        this.log(`🧪 Testing ${method} connection to ${targetPeer}`, 'info');
        
        try {
            switch (method) {
                case 'websocket':
                    return await this.testWebSocketConnection(targetPeer);
                case 'webrtc':
                    return await this.testWebRTCConnection(targetPeer);
                case 'nostr':
                    return await this.testNostrConnection(targetPeer);
                default:
                    throw new Error(`Unknown connection method: ${method}`);
            }
        } catch (error) {
            this.trackConnectionFailure(targetPeer, error.message, method);
            return false;
        }
    }

    async testWebSocketConnection(targetPeer) {
        const wsUrl = `ws://192.168.18.3:3001`;
        const ws = new WebSocket(wsUrl);
        
        return new Promise((resolve) => {
            const timeout = setTimeout(() => {
                ws.close();
                this.trackConnectionFailure(targetPeer, 'WebSocket timeout', 'websocket-connect');
                resolve(false);
            }, 5000);
            
            ws.onopen = () => {
                clearTimeout(timeout);
                this.trackConnectionSuccess(targetPeer, { method: 'websocket', url: wsUrl });
                ws.close();
                resolve(true);
            };
            
            ws.onerror = (error) => {
                clearTimeout(timeout);
                this.trackConnectionFailure(targetPeer, 'WebSocket error', 'websocket-connect');
                resolve(false);
            };
        });
    }

    async testWebRTCConnection(targetPeer) {
        try {
            const pc = new RTCPeerConnection({
                iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
            });
            
            const dc = pc.createDataChannel('test');
            
            return new Promise((resolve) => {
                const timeout = setTimeout(() => {
                    pc.close();
                    this.trackConnectionFailure(targetPeer, 'WebRTC timeout', 'webrtc-setup');
                    resolve(false);
                }, 10000);
                
                pc.onicecandidate = (event) => {
                    if (event.candidate === null) {
                        clearTimeout(timeout);
                        this.trackConnectionSuccess(targetPeer, { method: 'webrtc' });
                        pc.close();
                        resolve(true);
                    }
                };
                
                pc.createOffer().then(offer => {
                    pc.setLocalDescription(offer);
                }).catch(error => {
                    clearTimeout(timeout);
                    this.trackConnectionFailure(targetPeer, error.message, 'webrtc-offer');
                    resolve(false);
                });
            });
        } catch (error) {
            this.trackConnectionFailure(targetPeer, error.message, 'webrtc-setup');
            return false;
        }
    }

    async testNostrConnection(targetPeer) {
        try {
            // Test Nostr relay connection
            const relayUrl = 'wss://relay.damus.io';
            const ws = new WebSocket(relayUrl);
            
            return new Promise((resolve) => {
                const timeout = setTimeout(() => {
                    ws.close();
                    this.trackConnectionFailure(targetPeer, 'Nostr timeout', 'nostr-connect');
                    resolve(false);
                }, 5000);
                
                ws.onopen = () => {
                    clearTimeout(timeout);
                    this.trackConnectionSuccess(targetPeer, { method: 'nostr', relay: relayUrl });
                    ws.close();
                    resolve(true);
                };
                
                ws.onerror = (error) => {
                    clearTimeout(timeout);
                    this.trackConnectionFailure(targetPeer, 'Nostr error', 'nostr-connect');
                    resolve(false);
                };
            });
        } catch (error) {
            this.trackConnectionFailure(targetPeer, error.message, 'nostr-connect');
            return false;
        }
    }
}

// Global debugger instance
window.connectionDebugger = new ConnectionDebugger();

// Auto-start debugging if on H60
if (navigator.userAgent.includes('H60')) {
    console.log('🔧 H60 Connection Debugger Active');
    
    // Auto-analyze failures every 30 seconds
    setInterval(() => {
        window.connectionDebugger.analyzeFailures();
    }, 30000);
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ConnectionDebugger;
}
