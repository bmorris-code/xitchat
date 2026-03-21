
import React, { useState, useEffect } from 'react';
import { enhancedDiscovery, DiscoveredPeer } from '../services/enhancedDiscovery';
import {
  buildMyContactInvite,
  createInviteQrImageUrl,
  importContactInvite
} from '../services/contactInvite';

interface QRDiscoveryProps {
  onPeerConnected: (peer: DiscoveredPeer) => void;
}

const QRDiscovery: React.FC<QRDiscoveryProps> = ({ onPeerConnected }) => {
  const [myQRData, setMyQRData] = useState('');
  const [myInviteUrl, setMyInviteUrl] = useState('');
  const [myQrImageUrl, setMyQrImageUrl] = useState('');
  const [myHandle, setMyHandle] = useState('');
  const [myId, setMyId] = useState('');
  const [scanResult, setScanResult] = useState('');
  const [showScanner, setShowScanner] = useState(false);
  const [manualPeerId, setManualPeerId] = useState('');
  const [manualPeerName, setManualPeerName] = useState('');

  useEffect(() => {
    void generateMyQRCode();
  }, []);

  const generateMyQRCode = async () => {
    const { payload, urls } = await buildMyContactInvite();
    setMyQRData(JSON.stringify(payload));
    setMyInviteUrl(urls.landingUrl);
    setMyQrImageUrl(createInviteQrImageUrl(urls.landingUrl));
    setMyHandle(payload.handle);
    setMyId(payload.id);
  };

  const handleScanResult = (result: string) => {
    void (async () => {
      try {
        const peer = await importContactInvite(result);
        onPeerConnected(peer);
        setScanResult(result);
        setShowScanner(false);
      } catch (error) {
        console.error('Invalid QR code data:', error);
        alert('Invalid QR code. Please scan a valid XitChat invite.');
      }
    })();
  };

  const handleManualAdd = async () => {
    if (!manualPeerId || !manualPeerName) {
      alert('Please enter both peer ID and name');
      return;
    }

    try {
      await enhancedDiscovery.addPeerManually({
        id: manualPeerId,
        name: manualPeerName,
        handle: `@${manualPeerName.toLowerCase().replace(/\s+/g, '')}`
      });

      setManualPeerId('');
      setManualPeerName('');
      alert('Peer added successfully!');
    } catch (error) {
      console.error('Failed to add peer manually:', error);
      alert('Failed to add peer. Please try again.');
    }
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(myInviteUrl || myQRData).then(() => {
      alert('Invite link copied to clipboard!');
    });
  };

  const shareMyQR = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'XitChat Contact Invite',
          text: `Connect with me on XitChat: ${myHandle}`,
          url: myInviteUrl
        });
      } catch (error) {
        console.log('Share cancelled or failed:', error);
      }
    } else {
      copyToClipboard();
    }
  };

  return (
    <div className="flex-1 p-6 overflow-y-auto bg-black text-current font-mono no-scrollbar">
      {/* Header */}
      <div className="flex justify-between items-center mb-8 border-b border-current pb-4">
        <div>
          <h2 className="text-3xl font-bold uppercase tracking-tighter glow-text">discovery.exe</h2>
          <p className="text-[10px] font-bold opacity-50 uppercase tracking-widest text-white/30">secure_peer_handshake</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
        {/* My Identity Card */}
        <div className="border border-current border-opacity-30 p-6 bg-[#050505] space-y-6">
          <h3 className="text-sm font-bold uppercase tracking-[0.2em] text-current opacity-60">my_identity_qr</h3>

          <div className="bg-white p-6 rounded-xl flex flex-col items-center justify-center shadow-[0_0_30px_rgba(255,255,255,0.1)]">
            {myQrImageUrl && (
              <div className="text-center space-y-4">
                <img
                  src={myQrImageUrl}
                  alt="XitChat contact invite QR code"
                  className="w-48 h-48 border-4 border-black rounded-md"
                />
                <div className="space-y-1">
                  <p className="text-[10px] text-black font-black uppercase tracking-tighter">
                    {myHandle}
                  </p>
                  <p className="text-[8px] text-black/40 font-mono break-all max-w-[180px]">
                    {myId}
                  </p>
                </div>
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <button
              onClick={copyToClipboard}
              className="terminal-btn py-3 text-[10px] uppercase font-bold"
            >
              copy_id
            </button>
            <button
              onClick={shareMyQR}
              className="terminal-btn active py-3 text-[10px] uppercase font-bold"
            >
              share_link
            </button>
          </div>
        </div>

        {/* Scanner / Manual Entry */}
        <div className="space-y-8">
          <div className="border border-current border-opacity-30 p-6 bg-[#050505] space-y-6">
            <h3 className="text-sm font-bold uppercase tracking-[0.2em] text-current opacity-60">scan_peer_node</h3>

            <button
              onClick={() => setShowScanner(!showScanner)}
              className={`w-full py-6 border-2 border-dashed transition-all flex flex-col items-center justify-center gap-3 ${showScanner ? 'border-[#00ff41] bg-[#00ff41]/5' : 'border-current border-opacity-20 hover:border-opacity-100'
                }`}
            >
              <i className={`fa-solid ${showScanner ? 'fa-video' : 'fa-camera'} text-2xl`}></i>
              <span className="text-[10px] font-bold uppercase tracking-widest">
                {showScanner ? 'initializing_optics...' : 'launch_qr_scanner'}
              </span>
            </button>

            {showScanner && (
              <div className="space-y-4 animate-in fade-in slide-in-from-top-4">
                <div className="aspect-square bg-black border border-current border-opacity-20 relative overflow-hidden">
                  <div className="absolute inset-0 flex items-center justify-center opacity-20">
                    <i className="fa-solid fa-expand text-6xl"></i>
                  </div>
                  <div className="absolute inset-x-0 top-1/2 h-0.5 bg-[#00ff41] shadow-[0_0_15px_#00ff41] animate-scan"></div>
                </div>
                <input
                  type="text"
                  placeholder="paste_invite_link_or_payload..."
                  value={scanResult}
                  onChange={(e) => handleScanResult(e.target.value)}
                  className="w-full bg-black border border-current border-opacity-30 p-3 text-[10px] text-white font-mono placeholder-white/20 focus:border-opacity-100 outline-none transition-all"
                />
              </div>
            )}
          </div>

          <div className="border border-current border-opacity-30 p-6 bg-[#050505] space-y-6">
            <h3 className="text-sm font-bold uppercase tracking-[0.2em] text-current opacity-60">manual_uplink</h3>
            <div className="space-y-3">
              <input
                type="text"
                placeholder="node_public_key..."
                value={manualPeerId}
                onChange={(e) => setManualPeerId(e.target.value)}
                className="w-full bg-black border border-current border-opacity-30 p-3 text-[10px] text-white font-mono placeholder-white/20"
              />
              <input
                type="text"
                placeholder="node_alias..."
                value={manualPeerName}
                onChange={(e) => setManualPeerName(e.target.value)}
                className="w-full bg-black border border-current border-opacity-30 p-3 text-[10px] text-white font-mono placeholder-white/20"
              />
              <button
                onClick={handleManualAdd}
                className="terminal-btn active w-full py-3 text-[10px] uppercase font-bold"
              >
                establish_manual_connection
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-12 p-6 border border-current border-opacity-10 bg-[#050505] rounded-lg">
        <h4 className="text-[10px] font-bold uppercase tracking-[0.3em] text-current mb-4 opacity-60">discovery_protocols</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="flex gap-4">
            <i className="fa-solid fa-wifi text-[#00ff41] mt-1"></i>
            <p className="text-[10px] leading-relaxed opacity-40">
              <span className="text-white opacity-100 font-bold">LOCAL_MESH:</span> Automatic discovery via Bluetooth LE and WiFi P2P when in physical proximity.
            </p>
          </div>
          <div className="flex gap-4">
            <i className="fa-solid fa-link text-[#00ff41] mt-1"></i>
            <p className="text-[10px] leading-relaxed opacity-40">
              <span className="text-white opacity-100 font-bold">QR_HANDSHAKE:</span> Real QR invite opens XitChat directly, or falls back to the install page and preserves the contact payload.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default QRDiscovery;
