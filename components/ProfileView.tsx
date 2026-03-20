
import React, { useState, useEffect } from 'react';
import { meshDataSync } from '../services/meshDataSync';
import { realTorService } from '../services/realTorService';
import { realPowService } from '../services/realPowService';
import { nostrService } from '../services/nostrService';
import { releaseInfo } from '../services/releaseInfo';
import { trustStore, type VerifiedPeer } from '../services/trustStore';

interface ProfileViewProps {
  myHandle: string;
  setMyHandle: (val: string) => void;
  myAvatar: string;
  setMyAvatar: (val: string) => void;
  myMood: { text: string; emoji: string };
  setMyMood: (val: { text: string; emoji: string }) => void;
  uptime: number;
  balance: number;
  theme: 'green' | 'amber' | 'cyan' | 'red';
  setTheme: (theme: 'green' | 'amber' | 'cyan' | 'red') => void;
  onWipe: () => void;
  onSOS: () => void;
  onClose: () => void;
  onUplinkCoreChange?: (val: string) => void;
  installPrompt?: any;
  isInstalled?: boolean;
  onInstallApp?: () => void;
}

const ProfileView: React.FC<ProfileViewProps> = ({
  myHandle,
  setMyHandle,
  myAvatar,
  setMyAvatar,
  myMood,
  setMyMood,
  uptime,
  balance,
  theme,
  setTheme,
  onWipe,
  onSOS,
  onClose,
  onUplinkCoreChange,
  installPrompt,
  isInstalled,
  onInstallApp,
}) => {
  const avatarInputRef = React.useRef<HTMLInputElement>(null);
  const [appearance, setAppearance] = useState<'system' | 'light' | 'dark'>('dark');
  const [pow, setPow] = useState(false);
  const [tor, setTor] = useState(true);
  const [uplinkCore, setUplinkCore] = useState('ghost');
  const [torStatus, setTorStatus] = useState<any>(null);
  const [powStats, setPowStats] = useState<any>(null);
  const [showNostrKeys, setShowNostrKeys] = useState(false);
  const [nostrKeys, setNostrKeys] = useState({ pub: '' });
  const [verifiedPeers, setVerifiedPeers] = useState<VerifiedPeer[]>([]);
  const [showVerifiedPeers, setShowVerifiedPeers] = useState(false);
  // Load saved uplink core from localStorage
  useEffect(() => {
    const savedUplinkCore = localStorage.getItem('xitchat_uplink_core');
    if (savedUplinkCore) {
      setUplinkCore(savedUplinkCore);
    }

    // Load Nostr keys
    setNostrKeys({
      pub: nostrService.getPublicKey() || ''
    });

    void trustStore.list().then(setVerifiedPeers);
  }, []);

  // Initialize TOR and POW services
  useEffect(() => {
    // Load TOR status
    setTor(realTorService.getTorEnabled());
    setTorStatus(realTorService.getStatus());

    // Load POW status
    setPow(realPowService.getPOWEnabled());
    setPowStats(realPowService.getStats());

    // Subscribe to TOR updates
    const unsubscribeTor = realTorService.subscribe('statusUpdated', (status) => {
      setTorStatus(status);
    });

    const unsubscribeTorEnabled = realTorService.subscribe('torEnabled', () => {
      setTor(true);
    });

    const unsubscribeTorDisabled = realTorService.subscribe('torDisabled', () => {
      setTor(false);
    });

    // Subscribe to POW updates
    const unsubscribePow = realPowService.subscribe('statsUpdated', (stats) => {
      setPowStats(stats);
    });

    const unsubscribePowEnabled = realPowService.subscribe('powEnabled', () => {
      setPow(true);
    });

    const unsubscribePowDisabled = realPowService.subscribe('powDisabled', () => {
      setPow(false);
    });

    return () => {
      unsubscribeTor();
      unsubscribeTorEnabled();
      unsubscribeTorDisabled();
      unsubscribePow();
      unsubscribePowEnabled();
      unsubscribePowDisabled();
    };
  }, []);

  // Sync profile changes to mesh network and Nostr
  useEffect(() => {
    const profileData = {
      handle: myHandle,
      avatar: myAvatar,
      mood: myMood,
      theme: theme,
      uplinkCore: uplinkCore,
      lastUpdated: Date.now()
    };

    // 1. Broadcast profile changes to local mesh
    meshDataSync.syncUserProfile(profileData);

    // 2. Sync to Nostr for cross-device real-time updates
    const syncToNostr = async () => {
      try {
        await nostrService.updateProfile({
          name: myHandle,
          picture: myAvatar,
          about: myMood.text,
          custom_fields: {
            emoji: myMood.emoji,
            theme: theme,
            uplinkCore: uplinkCore
          }
        });
      } catch (error) {
        console.debug('Profile sync to Nostr skipped:', error);
      }
    };

    const timeoutId = setTimeout(() => {
      syncToNostr().catch((error) => {
        console.debug('Debounced profile sync failed:', error);
      });
    }, 2000); // Debounce Nostr updates
    return () => clearTimeout(timeoutId);
  }, [myHandle, myAvatar, myMood, theme, uplinkCore]);

  // TOR toggle handler
  const handleTorToggle = async (enabled: boolean) => {
    try {
      if (enabled) {
        await realTorService.enableTor();
      } else {
        await realTorService.disableTor();
      }
    } catch (error) {
      console.error('Failed to toggle TOR:', error);
    }
  };

  const handlePowToggle = async (enabled: boolean) => {
    try {
      if (enabled) {
        await realPowService.enablePOW();
      } else {
        await realPowService.disablePOW();
      }
    } catch (error) {
      console.error('Failed to toggle POW:', error);
    }
  };

  const handleUplinkCoreChange = (coreId: string) => {
    setUplinkCore(coreId);
    localStorage.setItem('xitchat_uplink_core', coreId);
    if (onUplinkCoreChange) {
      onUplinkCoreChange(coreId);
    }
  };

  const uplinkCores = [
    { id: 'ghost', icon: 'fa-ghost', color: '#00ff41', label: 'Ghost' },
    { id: 'robot', icon: 'fa-robot', color: '#00ffff', label: 'Robot' },
    { id: 'mojie', icon: 'fa-face-smile', color: '#ffb000', label: 'Mojie' },
    { id: 'alien', icon: 'fa-user-astronaut', color: '#ff3131', label: 'Alien' },
    { id: 'signal', icon: 'fa-satellite-dish', color: '#00ff41', label: 'Signal' },
    { id: 'shield', icon: 'fa-shield-halved', color: '#00ff41', label: 'Shield' },
    { id: 'pulse', icon: 'fa-heart-pulse', color: '#ff3131', label: 'Pulse' },
    { id: 'node', icon: 'fa-network-wired', color: '#00ffff', label: 'Node' },
    { id: 'star', icon: 'fa-star', color: '#ffb000', label: 'Star' },
  ];

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setMyAvatar(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    alert('Copied to clipboard!');
  };

  const themes: Array<{ id: 'green' | 'amber' | 'cyan' | 'red'; label: string; dotColor: string }> = [
    { id: 'green', label: 'MATRIX_GREEN', dotColor: 'bg-[#00ff41]' },
    { id: 'amber', label: 'AMBER_TERMINAL', dotColor: 'bg-[#ffb000]' },
    { id: 'cyan', label: 'CYBER_CYAN', dotColor: 'bg-[#00ffff]' },
    { id: 'red', label: 'ALERT_RED', dotColor: 'bg-[#ff3131]' },
  ];

  return (
    <div className="flex-1 p-4 sm:p-8 md:p-12 flex flex-col items-center overflow-y-auto bg-black no-scrollbar animate-in fade-in zoom-in-95 duration-300">
      <div className="max-w-md w-full space-y-10 pb-20 relative">

        {/* Header with Version and Close */}
        <div className="flex justify-between items-start mb-6">
          <div className="flex items-baseline gap-2">
            <h1 className="text-4xl font-bold text-current lowercase tracking-tighter">xitchat</h1>
            <span className="text-[10px] opacity-40 font-mono">v1.0.0</span>
          </div>
          <button
            onClick={onClose}
            className="text-current font-bold uppercase text-xs tracking-widest hover:opacity-70 transition-opacity"
          >
            Close
          </button>
        </div>

        {/* Profile Identity Card */}
        <div className="border border-current border-opacity-30 p-8 space-y-6 bg-[#050505] relative overflow-hidden shadow-[0_0_30px_rgba(0,0,0,0.5)]">
          <div className="flex justify-between items-start">
            <div
              className="w-20 h-20 border-2 border-current border-opacity-30 p-1 relative bg-black group cursor-pointer overflow-hidden shadow-[0_0_10px_rgba(0,255,65,0.1)]"
              onClick={() => avatarInputRef.current?.click()}
            >
              <img src={myAvatar} className="w-full h-full object-cover grayscale opacity-80 group-hover:opacity-100 transition-all" alt="" />
              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-all">
                <i className="fa-solid fa-camera text-white"></i>
              </div>
              <div className="absolute -bottom-1 -right-1 text-3xl bg-black rounded-full p-1 border-2 border-current shadow-[0_0_10px_rgba(0,255,65,0.2)]">
                <i className={`fa-solid ${uplinkCores.find(c => c.id === uplinkCore)?.icon || 'fa-ghost'}`}
                  style={{ color: uplinkCores.find(c => c.id === uplinkCore)?.color || '#00ff41' }}></i>
              </div>
            </div>
            <input type="file" ref={avatarInputRef} className="hidden" accept="image/*" onChange={handleAvatarChange} />

            <div className="text-right flex-1 ml-6">
              <div className="flex items-center gap-2 justify-end mb-1">
                <span className="text-white opacity-40 text-[9px] uppercase font-bold tracking-widest">node:</span>
                <input
                  value={myHandle}
                  onChange={(e) => setMyHandle(e.target.value)}
                  className="text-right bg-transparent border-none outline-none text-lg font-bold uppercase tracking-tighter glow-text text-white w-full max-w-[120px] focus:text-current transition-colors"
                />
              </div>
              <p className="text-[9px] font-bold opacity-30 uppercase tracking-widest text-white/30">id: {nostrKeys.pub.substring(0, 8).toUpperCase()}</p>
            </div>
          </div>

          <div className="space-y-3">
            <p className="text-[9px] font-bold opacity-30 uppercase tracking-[0.3em] text-current">broadcast_signal</p>
            <div className="flex items-center gap-4 bg-[#080808] p-3 border border-current border-opacity-20">
              <span className="text-lg drop-shadow-[0_0_5px_currentColor]">{myMood.emoji}</span>
              <input
                value={myMood.text}
                onChange={(e) => setMyMood({ ...myMood, text: e.target.value })}
                className="bg-transparent border-none outline-none text-xs w-full text-white font-mono placeholder-white/10"
                placeholder="broadcast_status..."
              />
            </div>
          </div>
        </div >

        {/* Nostr Keys Section */}
        <div className="space-y-4 border-t border-current border-opacity-10 pt-10">
          <div className="flex justify-between items-center">
            <h4 className="text-[10px] font-bold uppercase tracking-[0.3em] text-[#006600]">NOSTR_IDENTITY_KEYS</h4>
            <button
              onClick={() => setShowNostrKeys(!showNostrKeys)}
              className="text-[9px] uppercase font-bold text-current opacity-60 hover:opacity-100"
            >
              {showNostrKeys ? 'hide_keys' : 'show_keys'}
            </button>
          </div>

          {
            showNostrKeys && (
              <div className="space-y-4 animate-in slide-in-from-top-2 duration-300">
                <div className="bg-[#080808] border border-current border-opacity-20 p-4 space-y-2">
                  <p className="text-[8px] font-bold opacity-30 uppercase tracking-widest text-white/40">public_key (npub)</p>
                  <div className="flex items-center gap-2">
                    <code className="text-[10px] text-white opacity-80 break-all flex-1">{nostrKeys.pub}</code>
                    <button onClick={() => copyToClipboard(nostrKeys.pub)} className="text-current hover:scale-110 transition-transform">
                      <i className="fa-solid fa-copy"></i>
                    </button>
                  </div>
                </div>
                <p className="text-[9px] opacity-40 italic">Public key is shareable. Private keys are intentionally not exposed in-app.</p>
              </div>
            )}
        </div>

        {/* Verified Contacts */}
        <div className="space-y-4 border-t border-current border-opacity-10 pt-10">
          <div className="flex justify-between items-center">
            <h4 className="text-[10px] font-bold uppercase tracking-[0.3em] text-[#006600]">VERIFIED_CONTACTS</h4>
            <button
              onClick={async () => {
                const next = !showVerifiedPeers;
                setShowVerifiedPeers(next);
                if (next) setVerifiedPeers(await trustStore.list());
              }}
              className="text-[9px] uppercase font-bold text-current opacity-60 hover:opacity-100"
            >
              {showVerifiedPeers ? 'hide_list' : `show_list (${verifiedPeers.length})`}
            </button>
          </div>

          {showVerifiedPeers && (
            <div className="space-y-2 animate-in slide-in-from-top-2 duration-300">
              {verifiedPeers.length === 0 ? (
                <div className="bg-[#080808] border border-current border-opacity-20 p-4">
                  <p className="text-[10px] opacity-50">No verified contacts yet.</p>
                  <p className="text-[9px] opacity-40 mt-2">
                    Verify peers from chat by tapping <span className="text-amber-300">UNVERIFIED</span> → <span className="text-amber-300">VERIFY</span>.
                  </p>
                </div>
              ) : (
                verifiedPeers.map((peer) => (
                  <div key={peer.pubkey} className="bg-[#080808] border border-current border-opacity-20 p-3 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-[10px] font-bold uppercase tracking-widest text-white/70 truncate">
                        {peer.label || 'verified_peer'}
                      </p>
                      <p className="text-[9px] opacity-40 break-all">{peer.pubkey}</p>
                      <p className="text-[8px] opacity-30 uppercase tracking-widest mt-1">
                        verified: {new Date(peer.verifiedAt).toLocaleDateString()}
                      </p>
                    </div>
                    <button
                      onClick={async () => {
                        if (!confirm('Remove verification for this peer?')) return;
                        await trustStore.unverify(peer.pubkey);
                        setVerifiedPeers(await trustStore.list());
                      }}
                      className="terminal-btn px-3 py-2 text-[10px] uppercase font-bold"
                    >
                      remove
                    </button>
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        {/* Feature Highlights Section */}
        <div className="space-y-8 py-4 border-t border-current border-opacity-10 pt-10">
          <div className="flex items-start gap-5">
            <div className="mt-1 text-current w-6 text-center text-lg">
              <i className="fa-solid fa-satellite-dish"></i>
            </div>
            <div>
              <h3 className="text-current font-bold text-base tracking-tight mb-1">Real-time Nostr Sync</h3>
              <p className="text-[11px] opacity-60 leading-relaxed text-current">
                Your profile, status, and settings are synced across all your devices in real-time using the decentralized Nostr network.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-5">
            <div className="mt-1 text-current w-6 text-center text-lg">
              <i className="fa-solid fa-network-wired"></i>
            </div>
            <div>
              <h3 className="text-current font-bold text-base tracking-tight mb-1">Zero-Server Mesh</h3>
              <p className="text-[11px] opacity-60 leading-relaxed text-current">
                No central database. Your data lives on your device and is shared directly with peers or via decentralized relays.
              </p>
            </div>
          </div>
        </div >

        {/* Uplink Core Selection */}
        <div className="space-y-4">
          <h4 className="text-[10px] font-bold uppercase tracking-[0.3em] text-[#006600]">UPLINK_CORE_SELECTION</h4>
          <div className="grid grid-cols-3 gap-3">
            {uplinkCores.map((core) => (
              <button
                key={core.id}
                onClick={() => handleUplinkCoreChange(core.id)}
                className={`flex flex-col items-center gap-2 p-3 border transition-all bg-[#080808] relative group ${uplinkCore === core.id
                  ? 'border-current shadow-[0_0_15px_rgba(0,255,65,0.1)]'
                  : 'border-current border-opacity-20 opacity-40 hover:opacity-100 hover:border-opacity-100'
                  }`}
              >
                <div className={`text-lg transition-all ${uplinkCore === core.id ? 'scale-110' : 'scale-100'
                  }`} style={{ color: core.color }}>
                  <i className={`fa-solid ${core.icon}`}></i>
                </div>
                <span className={`text-[8px] font-bold uppercase tracking-wider font-mono ${uplinkCore === core.id ? 'text-white' : 'text-white/40'
                  }`}>
                  {core.label}
                </span>
                {uplinkCore === core.id && (
                  <div className="absolute inset-0 bg-current opacity-[0.03] pointer-events-none rounded"></div>
                )}
              </button>
            ))}
          </div>
        </div >

        {/* Node Appearance Settings */}
        < div className="space-y-4" >
          <h4 className="text-[10px] font-bold uppercase tracking-[0.3em] text-[#006600]">NODE_APPEARANCE</h4>
          <div className="grid grid-cols-2 gap-3">
            {themes.map((t) => (
              <button
                key={t.id}
                onClick={() => setTheme(t.id)}
                className={`flex items-center gap-4 p-4 border transition-all text-left bg-[#080808] relative group ${theme === t.id
                  ? 'border-[#00ff41] shadow-[0_0_15px_rgba(0,255,65,0.05)]'
                  : 'border-current border-opacity-20 opacity-40 hover:opacity-100 hover:border-opacity-100'
                  }`}
              >
                <div className={`w-3.5 h-3.5 rounded-full shrink-0 ${t.dotColor} ${theme === t.id ? 'shadow-[0_0_8px_currentColor] ring-2 ring-current ring-opacity-20' : 'opacity-40'
                  }`}></div>
                <span className={`text-[10px] font-bold uppercase tracking-wider font-mono ${theme === t.id ? 'text-white' : 'text-white/40'
                  }`}>
                  {t.label}
                </span>
                {theme === t.id && (
                  <div className="absolute inset-0 bg-current opacity-[0.03] pointer-events-none"></div>
                )}
              </button>
            ))}
          </div>
        </div >

        {/* Other Settings Sections */}
        < div className="space-y-10 border-t border-current border-opacity-10 pt-10" >

          {/* Appearance Section */}
          < div className="space-y-4" >
            <h4 className="text-[10px] font-bold opacity-40 uppercase tracking-[0.2em] text-current">appearance</h4>
            <div className="flex gap-3">
              {(['system', 'light', 'dark'] as const).map((mode) => (
                <button
                  key={mode}
                  onClick={() => setAppearance(mode)}
                  className={`px-6 py-2 border border-current text-[11px] font-mono tracking-widest transition-all ${appearance === mode ? 'bg-white/10 text-white border-opacity-100' : 'opacity-40 border-opacity-30'
                    }`}
                >
                  {mode}
                </button>
              ))}
            </div>
          </div >

          {/* Proof of Work Section */}
          < div className="space-y-4" >
            <h4 className="text-[10px] font-bold opacity-40 uppercase tracking-[0.2em] text-current">proof of work</h4>
            <div className="flex gap-3">
              <button
                onClick={() => handlePowToggle(false)}
                className={`px-6 py-2 border border-current text-[11px] font-mono tracking-widest transition-all ${!pow ? 'bg-white/10 text-white border-opacity-100' : 'opacity-40 border-opacity-30'
                  }`}
              >
                pow off
              </button>
              <button
                onClick={() => handlePowToggle(true)}
                className={`px-6 py-2 border border-current text-[11px] font-mono tracking-widest transition-all ${pow ? 'bg-white/10 text-white border-opacity-100' : 'opacity-40 border-opacity-30'
                  }`}
              >
                pow on
              </button>
            </div>

            {/* POW Status Log */}
            {
              pow && (
                <div className="mt-6 p-4 bg-[#111111] border border-current border-opacity-10 rounded-lg font-mono text-[10px] leading-relaxed">
                  <p className="text-current opacity-80 mb-2">
                    POW Status: <span className="text-[#00ff41]">Mining</span>
                  </p>
                  <div className="opacity-40 space-y-1">
                    <p>Difficulty: {powStats?.currentDifficulty || 1}</p>
                    <p>Hash Rate: {powStats?.hashRate ? (powStats.hashRate / 1000).toFixed(2) : '0.00'} KH/s</p>
                    <p>Solved: {powStats?.solvedChallenges || 0}/{powStats?.totalChallenges || 0}</p>
                    <p>Avg Time: {powStats?.averageSolveTime ? (powStats.averageSolveTime / 1000).toFixed(2) : '0.00'}s</p>
                    {powStats?.lastSolution && (
                      <p>Last: {powStats.lastSolution.hash.substring(0, 16)}...</p>
                    )}
                  </div>
                </div>
              )
            }
          </div >

          {/* Network Section */}
          < div className="space-y-4" >
            <h4 className="text-[10px] font-bold opacity-40 uppercase tracking-[0.2em] text-current">network</h4>
            <div className="flex gap-3">
              <button
                onClick={() => handleTorToggle(false)}
                className={`px-6 py-2 border border-current text-[11px] font-mono tracking-widest transition-all ${!tor ? 'bg-white/10 text-white border-opacity-100' : 'opacity-40 border-opacity-30'
                  }`}
              >
                tor off
              </button>
              <button
                onClick={() => handleTorToggle(true)}
                className={`px-6 py-2 border border-current text-[11px] font-mono tracking-widest transition-all relative ${tor ? 'bg-white/10 text-white border-opacity-100' : 'opacity-40 border-opacity-30'
                  }`}
              >
                tor on
                {tor && <span className="absolute right-2 top-2 w-1.5 h-1.5 rounded-full bg-[#00ff41] animate-pulse"></span>}
              </button>
            </div>

            {/* Tor Status Log */}
            <div className="mt-6 p-4 bg-[#111111] border border-current border-opacity-10 rounded-lg font-mono text-[10px] leading-relaxed">
              <p className="text-current opacity-80 mb-2">
                tor Status: <span className={torStatus?.connected ? 'text-[#00ff41]' : 'text-red-500'}>
                  {torStatus?.connected ? `Running, bootstrap ${torStatus.bootstrapProgress}%` : 'Disconnected'}
                </span>
              </p>
              <div className="opacity-40 space-y-1">
                <p>Last: [2m2025-09-15T12:39:12.870251Z[0m [32m INFO[0m</p>
                <p>[2mtor_guardmgr::guard[0m[:[0m We have found that guard [scrubbed] is usable.</p>
                {torStatus?.exitNode && (
                  <p>Exit Node: {torStatus.exitNode.nickname} ({torStatus.exitNode.country})</p>
                )}
                {torStatus?.bandwidth > 0 && (
                  <p>Bandwidth: {(torStatus.bandwidth / 1024 / 1024).toFixed(2)} MB/s</p>
                )}
                {torStatus?.circuitCount > 0 && (
                  <p>Active Circuits: {torStatus.circuitCount}</p>
                )}
              </div>
            </div>
          </div >
        </div >

        {/* System Actions */}
        < div className="pt-10 space-y-4 border-t border-current border-opacity-10" >
          {/* PWA Install Section */}
          {
            !isInstalled && installPrompt && (
              <div className="mb-6 p-4 border border-[#00ff41] border-opacity-30 bg-[#00ff41]/5 rounded-lg">
                <div className="flex items-center gap-3 mb-3">
                  <i className="fa-solid fa-download text-[#00ff41] text-lg"></i>
                  <h4 className="text-[10px] font-bold uppercase tracking-[0.3em] text-[#00ff41]">install_node</h4>
                </div>
                <p className="text-[11px] opacity-60 mb-4 text-current">
                  Install XitChat to your home screen for instant access and a native app experience.
                </p>
                <button
                  onClick={onInstallApp}
                  className="w-full bg-[#00ff41] text-black py-3 font-black uppercase text-xs tracking-[0.4em] hover:bg-[#00cc33] transition-all flex items-center justify-center gap-2"
                >
                  <i className="fa-solid fa-mobile-alt"></i>
                  Install Node to Home Screen
                </button>
              </div>
            )
          }

          {
            isInstalled && (
              <div className="mb-6 p-4 border border-current border-opacity-20 bg-[#050505] rounded-lg">
                <div className="flex items-center gap-3 mb-2">
                  <i className="fa-solid fa-check text-[#00ff41] text-lg"></i>
                  <h4 className="text-[10px] font-bold uppercase tracking-[0.3em] text-[#00ff41]">node_installed</h4>
                </div>
                <p className="text-[11px] opacity-60 text-current">
                  XitChat is installed on your device. Launch from home screen for the best experience.
                </p>
              </div>
            )
          }

          <div className="grid grid-cols-2 gap-4 mb-6">
            <div className="border border-current border-opacity-10 p-4 bg-[#080808]">
              <p className="text-[8px] font-bold opacity-30 uppercase tracking-widest mb-1 text-white/40">wallet</p>
              <p className="text-lg font-bold text-white glow-text">{balance} XC</p>
            </div>
            <div className="border border-current border-opacity-10 p-4 bg-[#080808]">
              <p className="text-[8px] font-bold opacity-30 uppercase tracking-widest mb-1 text-white/40">uptime</p>
              <p className="text-lg font-bold text-white glow-text">{Math.floor(uptime / 60)}m</p>
            </div>
          </div>

          {/* Android APK Download Section */}
          <div className="mb-6 p-4 border border-[#00ff41] border-opacity-30 bg-[#00ff41]/5 rounded-lg">
            <div className="flex items-center gap-3 mb-3">
              <i className="fa-solid fa-robot text-[#00ff41] text-lg"></i>
              <h4 className="text-[10px] font-bold uppercase tracking-[0.3em] text-[#00ff41]">native_mesh_upgrade</h4>
            </div>
            <p className="text-[11px] opacity-60 mb-4 text-current">
              Download the native Android app to unlock high-performance Bluetooth & WiFi Direct mesh networking.
            </p>
            <button
              onClick={() => {
                console.log('📱 Downloading APK from:', releaseInfo.apkDownloadUrl);
                try {
                  // Method 1: Direct download
                  const link = document.createElement('a');
                  link.href = releaseInfo.apkDownloadUrl;
                  link.download = `xitchat-v${releaseInfo.apkVersionLabel}.apk`;
                  link.style.display = 'none';
                  document.body.appendChild(link);
                  link.click();
                  document.body.removeChild(link);
                  
                  // Method 2: Fallback - open in new tab
                  setTimeout(() => {
                    window.open(releaseInfo.apkDownloadUrl, '_blank');
                  }, 1000);
                } catch (error) {
                  console.error('❌ Download failed:', error);
                  // Method 3: Final fallback
                  window.location.href = releaseInfo.apkDownloadUrl;
                }
              }}
              className="w-full bg-current text-black py-3 font-black uppercase text-xs tracking-[0.4em] hover:opacity-90 transition-all flex items-center justify-center gap-2 no-underline"
              style={{ backgroundColor: theme === 'green' ? '#00ff41' : theme === 'amber' ? '#ffb000' : theme === 'cyan' ? '#00ffff' : '#ff3131' }}
            >
              <i className="fa-brands fa-android text-base"></i>
              Download Android APK v{releaseInfo.apkVersionLabel}
            </button>
          </div>

          <button
            onClick={onSOS}
            className="w-full bg-red-900/40 border border-red-500 text-red-500 py-4 font-black uppercase text-xs tracking-[0.4em] hover:bg-red-500 hover:text-white transition-all"
          >
            emergency_sos
          </button>
          <button
            onClick={onWipe}
            className="w-full border border-red-500/20 text-red-500/50 hover:text-red-500 hover:border-red-500 py-3 uppercase text-[10px] font-bold tracking-[0.2em] transition-all"
          >
            wipe_node_identity (factory_reset)
          </button>
        </div>
      </div>
    </div>
  );
};

export default ProfileView;
