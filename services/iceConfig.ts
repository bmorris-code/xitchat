// ICE Server configuration for WebRTC peer connections
//
// STUN servers: help peers discover their public IP/port (free, no auth)
// TURN servers: relay traffic when direct P2P fails (requires auth)
//
// ── NOTE on openrelay.metered.ca ──────────────────────────────────────────
// The public openrelay TURN server uses shared credentials that are publicly
// known. It is rate-limited, unreliable for production, and should only be
// used for development/testing. For production, replace with your own TURN
// server or a paid service (Twilio, Metered.ca paid plan, Cloudflare Calls).
// ─────────────────────────────────────────────────────────────────────────

export const ICE_SERVERS: RTCIceServer[] = [
  // STUN — discover public IP, no credentials needed
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },

  // ── FIX #1: added TLS TURN over TCP (port 443) as primary relay ──
  // Port 443 is almost never blocked by firewalls (HTTPS port).
  // Try this before plain UDP/TCP TURN for better Android compatibility.
  {
    urls: 'turn:openrelay.metered.ca:443?transport=tcp',
    username: 'openrelayproject',
    credential: 'openrelayproject'
  },

  // TURN over UDP port 80 (fallback)
  {
    urls: 'turn:openrelay.metered.ca:80',
    username: 'openrelayproject',
    credential: 'openrelayproject'
  },

  // TURN over TCP port 443 (standard TLS relay fallback)
  {
    urls: 'turns:openrelay.metered.ca:443',
    username: 'openrelayproject',
    credential: 'openrelayproject'
  },

  // ── FIX #2: added backup public STUN servers ──
  // Google's servers occasionally rate-limit — having backups prevents
  // ICE candidate gathering failures on Android under load.
  { urls: 'stun:stun.cloudflare.com:3478' },
  { urls: 'stun:stun.stunprotocol.org:3478' }
];

// ── FIX #3: export ICE config object for RTCPeerConnection directly ──
// Use this in RTCPeerConnection({ iceServers: ICE_CONFIG.iceServers })
// to get additional tuning options alongside the server list.
export const ICE_CONFIG: RTCConfiguration = {
  iceServers: ICE_SERVERS,
  // Prefer UDP for lower latency; fall back to TCP on restricted networks
  iceTransportPolicy: 'all',
  // Gather candidates from all available interfaces (important on Android)
  bundlePolicy: 'max-bundle',
  // Reduce ICE candidate pairs to evaluate — faster connection on mobile
  rtcpMuxPolicy: 'require'
};
