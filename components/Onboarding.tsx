
import React from 'react';
import { androidPermissions } from '../services/androidPermissions';

interface OnboardingProps {
  onComplete: () => void;
}

const Onboarding: React.FC<OnboardingProps> = ({ onComplete }) => {
  const handleGrant = async () => {
    try {
      console.log('🔐 Starting comprehensive permission requests...');

      // Request all critical permissions using the new service
      const results = await androidPermissions.requestAllCriticalPermissions();

      // Check if any permissions are permanently denied
      if (androidPermissions.hasPermanentDenials(results)) {
        console.log('⚠️ Some permissions are permanently denied. User may need to enable them in settings.');
      }

      console.log('✅ Permission handshake completed');
    } catch (e) {
      console.log("⚠️ Permission handshake completed with some errors:", e);
    }

    localStorage.setItem('xitchat_onboarded', 'true');
    onComplete();
  };

  return (
    <div className="h-full w-full bg-black flex flex-col font-mono selection:bg-[#00ff41] selection:text-black relative overflow-hidden">
      {/* Scrollable Content Area */}
      <div className="flex-1 overflow-y-auto no-scrollbar pt-12 px-6 pb-32">
        <div className="max-w-md mx-auto w-full">
          {/* Brand Header */}
          <div className="mb-10">
            <h1 className="text-4xl font-bold text-[#00ff41] mb-2 lowercase tracking-tighter">xitchat</h1>
            <p className="text-[11px] text-[#00ff41] leading-relaxed opacity-80 font-medium">
              zero-server mesh messaging powered by nostr & bluetooth
            </p>
          </div>

          {/* Privacy Card */}
          <div className="bg-[#111111] rounded-2xl p-6 mb-10 border border-white/5 shadow-xl">
            <div className="flex items-center gap-4 mb-4">
              <div className="text-[#00ff41] text-xl">
                <i className="fa-solid fa-shield-halved"></i>
              </div>
              <h3 className="text-[#00ff41] font-bold text-base">True Serverless Privacy</h3>
            </div>
            <ul className="space-y-2">
              <li className="text-[10px] text-[#00ff41] opacity-70 flex items-start gap-2">
                <span className="mt-1">•</span>
                no central server, no sign-ups, no tracking
              </li>
              <li className="text-[10px] text-[#00ff41] opacity-70 flex items-start gap-2">
                <span className="mt-1">•</span>
                offline mesh: chat via bluetooth when internet is dead
              </li>
              <li className="text-[10px] text-[#00ff41] opacity-70 flex items-start gap-2">
                <span className="mt-1">•</span>
                global sync: real-time cross-device chat via nostr
              </li>
              <li className="text-[10px] text-[#00ff41] opacity-70 flex items-start gap-2">
                <span className="mt-1">•</span>
                local radar: find friends nearby using geohash
              </li>
            </ul>
          </div>

          {/* Permissions Header */}
          <h4 className="text-[11px] font-bold text-[#00ff41] uppercase tracking-[0.2em] mb-8 opacity-40">permissions</h4>

          {/* Permission Items */}
          <div className="space-y-10">
            {/* Bluetooth */}
            <div className="flex items-start gap-5">
              <div className="mt-1 text-[#00ff41] w-6 text-center text-xl">
                <i className="fa-solid fa-bluetooth"></i>
              </div>
              <div>
                <h3 className="text-[#00ff41] font-bold text-base tracking-tight mb-1">Nearby Devices</h3>
                <p className="text-[11px] text-[#00ff41] opacity-60 leading-relaxed">
                  Required to discover and chat with xitchat users via Bluetooth Mesh when offline.
                </p>
              </div>
            </div>

            {/* Location */}
            <div className="flex items-start gap-5">
              <div className="mt-1 text-[#00ff41] w-6 text-center text-xl">
                <i className="fa-solid fa-location-dot"></i>
              </div>
              <div>
                <h3 className="text-[#00ff41] font-bold text-base tracking-tight mb-1">Radar & Local Rooms</h3>
                <p className="text-[11px] text-[#00ff41] opacity-60 leading-relaxed mb-2">
                  Required for the Real-time Radar and to automatically join Local Area chat rooms.
                </p>
                <div className="flex items-start gap-2 text-orange-500">
                  <i className="fa-solid fa-triangle-exclamation text-[10px] mt-0.5"></i>
                  <p className="text-[10px] font-bold uppercase tracking-tight">xitchat does NOT store your location on any server</p>
                </div>
              </div>
            </div>

            {/* Camera */}
            <div className="flex items-start gap-5">
              <div className="mt-1 text-[#00ff41] w-6 text-center text-xl">
                <i className="fa-solid fa-camera"></i>
              </div>
              <div>
                <h3 className="text-[#00ff41] font-bold text-base tracking-tight mb-1">QR Handshakes</h3>
                <p className="text-[11px] text-[#00ff41] opacity-60 leading-relaxed">
                  Required to scan QR codes for instant peer discovery and secure handshakes.
                </p>
              </div>
            </div>

            {/* Notifications */}
            <div className="flex items-start gap-5">
              <div className="mt-1 text-[#00ff41] w-6 text-center text-xl">
                <i className="fa-solid fa-bell"></i>
              </div>
              <div>
                <h3 className="text-[#00ff41] font-bold text-base tracking-tight mb-1">Notifications</h3>
                <p className="text-[11px] text-[#00ff41] opacity-60 leading-relaxed">
                  Stay updated when you receive private mesh messages or local buzzes.
                </p>
              </div>
            </div>

            {/* Battery */}
            <div className="flex items-start gap-5">
              <div className="mt-1 text-[#00ff41] w-6 text-center text-xl">
                <i className="fa-solid fa-plug"></i>
              </div>
              <div>
                <h3 className="text-[#00ff41] font-bold text-base tracking-tight mb-1">Background Mesh</h3>
                <p className="text-[11px] text-[#00ff41] opacity-60 leading-relaxed">
                  Ensures xitchat stays connected to the mesh network even when your screen is off.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Fixed Bottom Button Area */}
      <div className="absolute bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-black via-black to-transparent pt-12">
        <div className="max-w-md mx-auto w-full">
          <button
            onClick={handleGrant}
            className="w-full bg-[#00ff41] text-black font-black py-5 rounded-3xl uppercase tracking-widest text-xs shadow-[0_0_30px_rgba(0,255,65,0.3)] active:scale-[0.97] transition-all"
          >
            Initialize Mesh
          </button>
        </div>
      </div>
    </div>
  );
};

export default Onboarding;
