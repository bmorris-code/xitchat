import React, { useState, useEffect } from 'react';
import { nativeDevice } from '../services/nativeDevice';

interface NativeFeaturesViewProps {
  onBack: () => void;
}

const NativeFeaturesView: React.FC<NativeFeaturesViewProps> = ({ onBack }) => {
  const [deviceInfo, setDeviceInfo] = useState<any>(null);
  const [position, setPosition] = useState<any>(null);
  const [cameraImage, setCameraImage] = useState<string | null>(null);
  const [pushEnabled, setPushEnabled] = useState(false);
  const [scannedNodes, setScannedNodes] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    setDeviceInfo(nativeDevice.getDeviceInfo());
  }, []);

  const handleTakePicture = async () => {
    setIsLoading(true);
    const image = await nativeDevice.takePicture();
    if (image) {
      setCameraImage(image);
      await nativeDevice.triggerHaptic();
    }
    setIsLoading(false);
  };

  const handleGetLocation = async () => {
    setIsLoading(true);
    const pos = await nativeDevice.getCurrentPosition();
    if (pos) {
      setPosition(pos);
      await nativeDevice.triggerHaptic();
    }
    setIsLoading(false);
  };

  const handleEnablePush = async () => {
    setIsLoading(true);
    const success = await nativeDevice.initializePushNotifications();
    setPushEnabled(success);
    if (success) {
      await nativeDevice.triggerHaptic();
    }
    setIsLoading(false);
  };

  const handleScanNodes = async () => {
    setIsLoading(true);
    const nodes = await nativeDevice.scanForMeshNodes();
    setScannedNodes(nodes);
    setIsLoading(false);
  };

  return (
    <div className="flex-1 p-6 overflow-y-auto bg-black text-current animate-in fade-in zoom-in-95 duration-300">
      <div className="flex justify-between items-center mb-10 border-b border-current pb-4">
        <div>
          <h2 className="text-3xl font-bold uppercase tracking-tighter glow-text text-green-400">native_features.exe</h2>
          <p className="text-[10px] font-bold opacity-50 uppercase tracking-[0.2em] mt-1 text-white/40">device_capabilities</p>
        </div>
        <button 
          onClick={onBack}
          className="terminal-btn active py-2 px-4 text-xs"
        >
          BACK
        </button>
      </div>

      {/* Device Info */}
      {deviceInfo && (
        <div className="mb-8 p-4 border border-current border-opacity-20 bg-[#050505]">
          <h3 className="text-lg font-bold uppercase mb-4 text-green-400">device_info</h3>
          <div className="space-y-2 text-[10px] font-mono">
            <div>platform: <span className="text-white">{deviceInfo.platform}</span></div>
            <div>is_native: <span className={deviceInfo.isNative ? "text-green-400" : "text-red-400"}>{deviceInfo.isNative.toString()}</span></div>
            <div>is_android: <span className={deviceInfo.isAndroid ? "text-green-400" : "text-red-400"}>{deviceInfo.isAndroid?.toString() || "false"}</span></div>
            <div>is_ios: <span className={deviceInfo.isIOS ? "text-green-400" : "text-red-400"}>{deviceInfo.isIOS?.toString() || "false"}</span></div>
          </div>
        </div>
      )}

      {/* Feature Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* Camera */}
        <div className="p-6 border border-current border-opacity-20 bg-[#050505]">
          <h3 className="text-lg font-bold uppercase mb-4 text-amber-400">camera_module</h3>
          <button 
            onClick={handleTakePicture}
            disabled={isLoading}
            className="terminal-btn active w-full py-3 mb-4 text-xs"
          >
            {isLoading ? "PROCESSING..." : "CAPTURE_IMAGE"}
          </button>
          {cameraImage && (
            <div className="mt-4">
              <img src={cameraImage} alt="Captured" className="w-full h-32 object-cover border border-current" />
            </div>
          )}
        </div>

        {/* Geolocation */}
        <div className="p-6 border border-current border-opacity-20 bg-[#050505]">
          <h3 className="text-lg font-bold uppercase mb-4 text-cyan-400">geolocation_module</h3>
          <button 
            onClick={handleGetLocation}
            disabled={isLoading}
            className="terminal-btn active w-full py-3 mb-4 text-xs"
          >
            {isLoading ? "LOCATING..." : "GET_POSITION"}
          </button>
          {position && (
            <div className="mt-4 text-[10px] font-mono space-y-1">
              <div>lat: <span className="text-white">{position.coords.latitude.toFixed(6)}</span></div>
              <div>lng: <span className="text-white">{position.coords.longitude.toFixed(6)}</span></div>
              <div>accuracy: <span className="text-white">{position.coords.accuracy.toFixed(0)}m</span></div>
            </div>
          )}
        </div>

        {/* Push Notifications */}
        <div className="p-6 border border-current border-opacity-20 bg-[#050505]">
          <h3 className="text-lg font-bold uppercase mb-4 text-purple-400">push_notifications</h3>
          <button 
            onClick={handleEnablePush}
            disabled={isLoading || pushEnabled}
            className="terminal-btn active w-full py-3 mb-4 text-xs"
          >
            {pushEnabled ? "ENABLED" : isLoading ? "INITIALIZING..." : "ENABLE_PUSH"}
          </button>
          <div className={`text-[10px] font-mono ${pushEnabled ? "text-green-400" : "text-red-400"}`}>
            status: {pushEnabled ? "ACTIVE" : "INACTIVE"}
          </div>
        </div>

        {/* Mesh Node Scanner */}
        <div className="p-6 border border-current border-opacity-20 bg-[#050505]">
          <h3 className="text-lg font-bold uppercase mb-4 text-green-400">mesh_scanner</h3>
          <button 
            onClick={handleScanNodes}
            disabled={isLoading}
            className="terminal-btn active w-full py-3 mb-4 text-xs"
          >
            {isLoading ? "SCANNING..." : "SCAN_NODES"}
          </button>
          {scannedNodes.length > 0 && (
            <div className="mt-4 space-y-1">
              {scannedNodes.map((node, index) => (
                <div key={index} className="text-[10px] font-mono text-green-400 animate-pulse">
                  {'>'} {node}
                </div>
              ))}
            </div>
          )}
        </div>

      </div>

      {/* Haptic Test */}
      <div className="mt-8 p-6 border border-current border-opacity-20 bg-[#050505]">
        <h3 className="text-lg font-bold uppercase mb-4 text-orange-400">haptic_feedback</h3>
        <div className="grid grid-cols-3 gap-4">
          <button 
            onClick={() => nativeDevice.triggerHaptic('Light' as any)}
            className="terminal-btn py-2 text-xs"
          >
            LIGHT
          </button>
          <button 
            onClick={() => nativeDevice.triggerHaptic('Medium' as any)}
            className="terminal-btn py-2 text-xs"
          >
            MEDIUM
          </button>
          <button 
            onClick={() => nativeDevice.triggerHaptic('Heavy' as any)}
            className="terminal-btn py-2 text-xs"
          >
            HEAVY
          </button>
        </div>
      </div>

    </div>
  );
};

export default NativeFeaturesView;
