
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
        
        // You could show a dialog here directing user to settings
        // For now, we'll just continue with the onboarding
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
              decentralized mesh messaging with end-to-end encryption
            </p>
          </div>

          {/* Privacy Card */}
          <div className="bg-[#111111] rounded-2xl p-6 mb-10 border border-white/5 shadow-xl">
            <div className="flex items-center gap-4 mb-4">
               <div className="text-[#00ff41] text-xl">
                 <i className="fa-solid fa-shield-halved"></i>
               </div>
               <h3 className="text-[#00ff41] font-bold text-base">Your Privacy is Protected</h3>
            </div>
            <ul className="space-y-2">
              <li className="text-[10px] text-[#00ff41] opacity-70 flex items-start gap-2">
                <span className="mt-1">•</span>
                no tracking or data collection
              </li>
              <li className="text-[10px] text-[#00ff41] opacity-70 flex items-start gap-2">
                <span className="mt-1">•</span>
                Bluetooth mesh chats are fully offline
              </li>
              <li className="text-[10px] text-[#00ff41] opacity-70 flex items-start gap-2">
                <span className="mt-1">•</span>
                Geohash chats use the internet
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
                  Required to discover xitchat users via Bluetooth
                </p>
              </div>
            </div>

            {/* Location */}
            <div className="flex items-start gap-5">
              <div className="mt-1 text-[#00ff41] w-6 text-center text-xl">
                <i className="fa-solid fa-location-dot"></i>
              </div>
              <div>
                <h3 className="text-[#00ff41] font-bold text-base tracking-tight mb-1">Precise Location</h3>
                <p className="text-[11px] text-[#00ff41] opacity-60 leading-relaxed mb-2">
                  Required by Android to discover nearby xitchat users via Bluetooth
                </p>
                <div className="flex items-start gap-2 text-orange-500">
                  <i className="fa-solid fa-triangle-exclamation text-[10px] mt-0.5"></i>
                  <p className="text-[10px] font-bold uppercase tracking-tight">xitchat does NOT track your location</p>
                </div>
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
                  Receive notifications when you receive private messages
                </p>
              </div>
            </div>

            {/* Battery */}
            <div className="flex items-start gap-5">
              <div className="mt-1 text-[#00ff41] w-6 text-center text-xl">
                <i className="fa-solid fa-plug"></i>
              </div>
              <div>
                <h3 className="text-[#00ff41] font-bold text-base tracking-tight mb-1">Battery Optimization</h3>
                <p className="text-[11px] text-[#00ff41] opacity-60 leading-relaxed">
                  Disable battery optimization to ensure xitchat runs reliably in the background and maintains mesh network connections
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
            Grant Permissions
          </button>
        </div>
      </div>
    </div>
  );
};

export default Onboarding;
