import React, { useState, useEffect } from 'react';
import { androidPermissions, PermissionResult } from '../services/androidPermissions';
import { releaseInfo } from '../services/releaseInfo';
import { downloadApk } from '../services/installFlow';

interface OnboardingProps {
  onComplete: () => void;
  installPrompt?: unknown;
  isInstalled?: boolean;
  onInstallApp?: () => void;
}

const Onboarding: React.FC<OnboardingProps> = ({ onComplete, installPrompt, isInstalled, onInstallApp }) => {
  const isWeb = !(window as any).Capacitor?.isNativePlatform?.();
  const hasInstallPrompt = Boolean(installPrompt);
  
  const [permissionStatus, setPermissionStatus] = useState<{
    camera: PermissionResult;
    location: PermissionResult;
    bluetooth: PermissionResult;
    push: PermissionResult;
  } | null>(null);
  
  const [isRequesting, setIsRequesting] = useState(false);
  const [permissionError, setPermissionError] = useState<string | null>(null);

  useEffect(() => {
    // Check current permission status on mount
    const checkPermissions = async () => {
      if (!isWeb) {
        try {
          const status = await androidPermissions.checkPermissionStatus();
          const cameraResult = { granted: status.camera === 'granted', denied: status.camera === 'denied', permanentlyDenied: false, canAskAgain: true };
          const locationResult = { granted: status.location === 'granted', denied: status.location === 'denied', permanentlyDenied: false, canAskAgain: true };
          const pushResult = { granted: status.push === 'granted', denied: status.push === 'denied', permanentlyDenied: false, canAskAgain: true };
          
          setPermissionStatus({
            camera: cameraResult,
            location: locationResult,
            bluetooth: { granted: false, denied: false, permanentlyDenied: false, canAskAgain: true }, // Will be checked during request
            push: pushResult
          });
        } catch (error) {
          console.error('Failed to check permission status:', error);
        }
      }
    };
    
    checkPermissions();
  }, [isWeb]);

  const handleGrant = async () => {
    setIsRequesting(true);
    setPermissionError(null);
    try {
      console.log('Starting permission requests...');

      if (!isWeb) {
        const results = await androidPermissions.requestAllCriticalPermissions();
        setPermissionStatus(results);

        if (androidPermissions.hasPermanentDenials(results)) {
          setPermissionError('Some permissions were permanently denied. You can enable them in device Settings later.');
          // Still proceed — mesh works without all permissions
        } else if (!results.overallGranted) {
          setPermissionError('Some permissions were not granted. Mesh features may be limited.');
          // Still proceed
        }
      }

      localStorage.setItem('xitchat_onboarded', 'true');
      onComplete();
    } catch (e) {
      console.error('Permission request error:', e);
      // Always proceed — don't block the user
      localStorage.setItem('xitchat_onboarded', 'true');
      onComplete();
    } finally {
      setIsRequesting(false);
    }
  };

  return (
    <div className="h-full w-full bg-black flex flex-col font-mono selection:bg-[#00ff41] selection:text-black relative overflow-hidden">
      <div className="flex-1 overflow-y-auto no-scrollbar pt-12 px-6 pb-32">
        <div className="max-w-md mx-auto w-full">
          <div className="mb-10">
            <h1 className="text-4xl font-bold text-[#00ff41] mb-2 lowercase tracking-tighter">xitchat</h1>
            <p className="text-[11px] text-[#00ff41] leading-relaxed opacity-80 font-medium">
              zero-server mesh messaging powered by nostr & bluetooth
            </p>
          </div>

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

          <h4 className="text-[11px] font-bold text-[#00ff41] uppercase tracking-[0.2em] mb-8 opacity-40">permissions</h4>

          <div className="space-y-10">
            <div className="flex items-start gap-5">
              <div className="mt-1 w-6 text-center">
                {permissionStatus?.bluetooth.granted ? (
                  <i className="fa-solid fa-check-square text-[#00ff41] text-xl"></i>
                ) : (
                  <i className="fa-solid fa-square text-white/40 text-xl"></i>
                )}
              </div>
              <div className="flex-1">
                <h3 className="text-[#00ff41] font-bold text-base tracking-tight mb-1">Nearby Devices</h3>
                <p className="text-[11px] text-[#00ff41] opacity-60 leading-relaxed">
                  Required to discover and chat with xitchat users via Bluetooth Mesh when offline.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-5">
              <div className="mt-1 w-6 text-center">
                {permissionStatus?.location.granted ? (
                  <i className="fa-solid fa-check-square text-[#00ff41] text-xl"></i>
                ) : (
                  <i className="fa-solid fa-square text-white/40 text-xl"></i>
                )}
              </div>
              <div className="flex-1">
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

            <div className="flex items-start gap-5">
              <div className="mt-1 w-6 text-center">
                {permissionStatus?.camera.granted ? (
                  <i className="fa-solid fa-check-square text-[#00ff41] text-xl"></i>
                ) : (
                  <i className="fa-solid fa-square text-white/40 text-xl"></i>
                )}
              </div>
              <div className="flex-1">
                <h3 className="text-[#00ff41] font-bold text-base tracking-tight mb-1">QR Handshakes</h3>
                <p className="text-[11px] text-[#00ff41] opacity-60 leading-relaxed">
                  Required to scan QR codes for instant peer discovery and secure handshakes.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-5">
              <div className="mt-1 w-6 text-center">
                {permissionStatus?.push.granted ? (
                  <i className="fa-solid fa-check-square text-[#00ff41] text-xl"></i>
                ) : (
                  <i className="fa-solid fa-square text-white/40 text-xl"></i>
                )}
              </div>
              <div className="flex-1">
                <h3 className="text-[#00ff41] font-bold text-base tracking-tight mb-1">Notifications</h3>
                <p className="text-[11px] text-[#00ff41] opacity-60 leading-relaxed">
                  To stay updated.
                </p>
              </div>
            </div>

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

            {isWeb && (
              <>
                {!isInstalled && (
                  <div className="flex items-start gap-5 pt-8 border-t border-[#00ff41]/20">
                    <div className="mt-1 text-[#00ff41] w-6 text-center text-xl">
                      <i className="fa-solid fa-mobile-screen-button"></i>
                    </div>
                    <div className="flex-1">
                      <h3 className="text-[#00ff41] font-bold text-base tracking-tight mb-1">Install Web App (PWA)</h3>
                      <p className="text-[11px] text-[#00ff41] opacity-60 leading-relaxed mb-3">
                        Install XitChat from this browser for quick launch from your home screen.
                      </p>
                      <button
                        onClick={hasInstallPrompt ? onInstallApp : () => window.location.href = releaseInfo.downloadPageUrl}
                        className="inline-flex items-center gap-2 bg-[#00ff41] text-black px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider hover:opacity-90 transition-colors"
                      >
                        <i className="fa-solid fa-download"></i>
                        {hasInstallPrompt ? 'Install Web App (PWA)' : 'Open PWA Install Help'}
                      </button>
                      {!hasInstallPrompt && (
                        <p className="text-[10px] text-[#00ff41] opacity-50 leading-relaxed mt-3">
                          If the browser does not show the install prompt, use your browser menu and choose Add to Home Screen or Install App.
                        </p>
                      )}
                    </div>
                  </div>
                )}

                <div className="flex items-start gap-5 pt-8 border-t border-[#00ff41]/20">
                  <div className="mt-1 text-[#00ff41] w-6 text-center text-xl">
                    <i className="fa-brands fa-android"></i>
                  </div>
                  <div className="flex-1">
                    <h3 className="text-[#00ff41] font-bold text-base tracking-tight mb-1">Download Android APK</h3>
                    <p className="text-[11px] text-[#00ff41] opacity-60 leading-relaxed mb-3">
                      Download the Android APK v{releaseInfo.apkVersionLabel} for Bluetooth and WiFi Direct mesh support.
                    </p>
                    <button
                      onClick={() => {
                        console.log('Downloading APK from:', releaseInfo.apkDownloadUrl);
                        try {
                          downloadApk();
                        } catch (error) {
                          console.error('APK download failed:', error);
                          window.location.href = releaseInfo.downloadPageUrl;
                        }
                      }}
                      className="inline-flex items-center gap-2 bg-[#00ff41]/10 border border-[#00ff41] text-[#00ff41] px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider hover:bg-[#00ff41]/20 transition-colors"
                    >
                      <i className="fa-solid fa-download"></i>
                      Download Android APK v{releaseInfo.apkVersionLabel}
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="absolute bottom-0 left-0 right-0 p-6 pb-safe bg-gradient-to-t from-black via-black to-transparent pt-12" style={{ paddingBottom: 'max(1.5rem, env(safe-area-inset-bottom))' }}>
        <div className="max-w-md mx-auto w-full">
          {permissionError && (
            <p className="text-[10px] text-amber-400 text-center mb-3 px-2">{permissionError}</p>
          )}
          <button
            onClick={handleGrant}
            disabled={isRequesting}
            className={`w-full font-black py-5 rounded-3xl uppercase tracking-widest text-xs shadow-[0_0_30px_rgba(0,255,65,0.3)] active:scale-[0.97] transition-all ${
              isRequesting 
                ? 'bg-gray-600 text-gray-400 cursor-not-allowed' 
                : 'bg-[#00ff41] text-black hover:bg-[#00cc33]'
            }`}
          >
            {isRequesting ? (
              <span className="flex items-center justify-center gap-2">
                <i className="fa-solid fa-spinner fa-spin"></i>
                Requesting Permissions...
              </span>
            ) : (
              'Initialize Mesh'
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default Onboarding;

