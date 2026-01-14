import React, { useState, useEffect } from 'react';
import { enhancedDiscovery, DiscoveredPeer } from '../services/enhancedDiscovery';

interface QRDiscoveryProps {
  onPeerConnected: (peer: DiscoveredPeer) => void;
}

const QRDiscovery: React.FC<QRDiscoveryProps> = ({ onPeerConnected }) => {
  const [myQRData, setMyQRData] = useState('');
  const [scanResult, setScanResult] = useState('');
  const [showScanner, setShowScanner] = useState(false);
  const [manualPeerId, setManualPeerId] = useState('');
  const [manualPeerName, setManualPeerName] = useState('');

  useEffect(() => {
    generateMyQRCode();
  }, []);

  const generateMyQRCode = () => {
    const myData = {
      id: generatePeerId(),
      name: localStorage.getItem('xitchat_name') || 'XitChat User',
      handle: localStorage.getItem('xitchat_handle') || '@user',
      timestamp: Date.now()
    };
    
    const qrString = JSON.stringify(myData);
    setMyQRData(qrString);
  };

  const generatePeerId = (): string => {
    return 'xitchat-' + Math.random().toString(36).substr(2, 9);
  };

  const handleScanResult = (result: string) => {
    try {
      const peerData = JSON.parse(result);
      addPeerFromQR(peerData);
      setScanResult(result);
      setShowScanner(false);
    } catch (error) {
      console.error('Invalid QR code data:', error);
      alert('Invalid QR code. Please scan a valid XitChat QR code.');
    }
  };

  const addPeerFromQR = async (peerData: any) => {
    try {
      await enhancedDiscovery.addPeerManually({
        id: peerData.id,
        name: peerData.name,
        handle: peerData.handle
      });
      
      // Try to connect to the peer
      const connected = await enhancedDiscovery.connectToPeer(peerData.id);
      if (connected) {
        onPeerConnected({
          id: peerData.id,
          name: peerData.name,
          handle: peerData.handle,
          discoveryMethod: 'qr-code',
          isConnected: true,
          lastSeen: Date.now()
        });
      }
    } catch (error) {
      console.error('Failed to add peer from QR:', error);
    }
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
    navigator.clipboard.writeText(myQRData).then(() => {
      alert('QR data copied to clipboard! Share this with other users.');
    });
  };

  const shareMyQR = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'XitChat Peer Connection',
          text: `Connect with me on XitChat! Peer ID: ${JSON.parse(myQRData).id}`,
          url: myQRData
        });
      } catch (error) {
        console.log('Share cancelled or failed:', error);
      }
    } else {
      copyToClipboard();
    }
  };

  return (
    <div className="p-6 bg-[#0a0a0a] border border-green-500/30 rounded-lg">
      <h3 className="text-xl font-bold text-green-400 mb-4">🔗 Peer Discovery</h3>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* My QR Code */}
        <div className="space-y-4">
          <h4 className="text-lg font-semibold text-green-300">Share Your QR Code</h4>
          
          <div className="bg-white p-4 rounded-lg flex items-center justify-center">
            {myQRData && (
              <div className="text-center">
                <div className="w-48 h-48 bg-gray-800 flex items-center justify-center rounded">
                  <div className="text-xs text-gray-400 p-2">
                    QR Code Placeholder<br/>
                    (Install QR library for display)
                  </div>
                </div>
                <p className="text-xs text-gray-600 mt-2 break-all">
                  {JSON.parse(myQRData).id}
                </p>
              </div>
            )}
          </div>
          
          <div className="flex gap-2">
            <button
              onClick={copyToClipboard}
              className="flex-1 px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 transition-colors"
            >
              📋 Copy
            </button>
            <button
              onClick={shareMyQR}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
            >
              📤 Share
            </button>
          </div>
        </div>

        {/* Add Peer */}
        <div className="space-y-4">
          <h4 className="text-lg font-semibold text-green-300">Add Peer</h4>
          
          {/* Manual Entry */}
          <div className="space-y-2">
            <input
              type="text"
              placeholder="Peer ID"
              value={manualPeerId}
              onChange={(e) => setManualPeerId(e.target.value)}
              className="w-full px-3 py-2 bg-black/50 border border-green-500/30 rounded text-white placeholder-gray-500"
            />
            <input
              type="text"
              placeholder="Peer Name"
              value={manualPeerName}
              onChange={(e) => setManualPeerName(e.target.value)}
              className="w-full px-3 py-2 bg-black/50 border border-green-500/30 rounded text-white placeholder-gray-500"
            />
            <button
              onClick={handleManualAdd}
              className="w-full px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 transition-colors"
            >
              ➕ Add Peer Manually
            </button>
          </div>

          {/* QR Scanner */}
          <div className="space-y-2">
            <button
              onClick={() => setShowScanner(!showScanner)}
              className="w-full px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700 transition-colors"
            >
              📷 {showScanner ? 'Hide' : 'Show'} QR Scanner
            </button>
            
            {showScanner && (
              <div className="bg-black/50 border border-purple-500/30 rounded p-4">
                <div className="w-full h-48 bg-gray-800 flex items-center justify-center rounded">
                  <div className="text-center text-gray-400">
                    📷 QR Scanner<br/>
                    (Install camera/QR library)
                  </div>
                </div>
                <input
                  type="text"
                  placeholder="Or paste QR data here"
                  value={scanResult}
                  onChange={(e) => handleScanResult(e.target.value)}
                  className="w-full mt-2 px-3 py-2 bg-black/50 border border-purple-500/30 rounded text-white placeholder-gray-500"
                />
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="mt-6 p-4 bg-yellow-900/20 border border-yellow-500/30 rounded">
        <h4 className="text-sm font-semibold text-yellow-400 mb-2">💡 Connection Tips:</h4>
        <ul className="text-xs text-yellow-300 space-y-1">
          <li>• Both users must be on the same local network for automatic discovery</li>
          <li>• QR codes work for manual connections across any network</li>
          <li>• Bluetooth requires Android devices with location permissions</li>
          <li>• Share your Peer ID with friends to connect directly</li>
        </ul>
      </div>
    </div>
  );
};

export default QRDiscovery;
