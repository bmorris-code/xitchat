
import React, { useState, useCallback, useEffect, useRef } from 'react';
import { View, Chat, User, Message, Reaction } from './types';
import { INITIAL_CHATS } from './constants';
import { streamXitBotResponse, hybridAI } from './services/hybridAI';
import { meshDataSync } from './services/meshDataSync';
import { hybridMesh } from './services/hybridMesh';
import { enhancedDiscovery } from './services/enhancedDiscovery';
import { realtimeRadar, RadarPeer } from './services/realtimeRadar';
import { presenceBeacon } from './services/presenceBeacon';
import { xcEconomy } from './services/xcEconomy';
import { realTorService } from './services/realTorService';
import { realPowService } from './services/realPowService';
import { realMarketplaceService } from './services/realMarketplaceService';
import { nostrService, NostrPeer } from './services/nostrService';
import { geohashChannels } from './services/geohashChannels';
import Sidebar from './components/Sidebar';
import ChatList from './components/ChatList';
import ChatWindow from './components/ChatWindow';
import MapView from './components/MapView';
import BuzzView from './components/BuzzView';
import RoomsView from './components/RoomsView';
import GamesView from './components/GamesView';
import Onboarding from './components/Onboarding';
import MarketplaceView from './components/MarketplaceView';
import ProfileView from './components/ProfileView';
import NodeShopView from './components/NodeShopView';
import MeshMarketplaceView from './components/MeshMarketplaceView';
import QRDiscovery from './components/QRDiscovery';
import JoeBankerView from './components/JoeBankerView';
import XCDashboard from './components/XCDashboard';
import GalleryView from './components/GalleryView';
import NativeFeaturesView from './components/NativeFeaturesView';
import TransmissionToast from './components/TransmissionToast';
import { handshakePersistence, HandshakeNode } from './services/handshakePersistence';

const App: React.FC = () => {
  console.log('App component initializing...');

  const [view, setView] = useState<View>('chats');
  const [chats, setChats] = useState<Chat[]>(INITIAL_CHATS);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const [showOnboarding, setShowOnboarding] = useState(false);
  // Fix: Added missing state for inviting nodes
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [isBooting, setIsBooting] = useState(true);
  const [bootLogs, setBootLogs] = useState<string[]>([]);
  const [theme, setTheme] = useState<'green' | 'amber' | 'cyan' | 'red'>('green');
  const [balance, setBalance] = useState(1240);
  const [installPrompt, setInstallPrompt] = useState<any>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [transmissions, setTransmissions] = useState<Array<{ id: string, message: string, type: 'buzz' | 'chat' | 'system', timestamp: number }>>([]);
  const [nostrConnected, setNostrConnected] = useState(false);
  const [nostrPeers, setNostrPeers] = useState<NostrPeer[]>([]);
  const [discoveredPeers, setDiscoveredPeers] = useState<any[]>([]);
  const [radarPeers, setRadarPeers] = useState<RadarPeer[]>([]);
  const [showQRDiscovery, setShowQRDiscovery] = useState(false);
  const [isRealMode, setIsRealMode] = useState(true);
  const botRequestCounterRef = useRef(0);
  const [botStreamState, setBotStreamState] = useState<{ active: boolean; provider: string }>({
    active: false,
    provider: 'auto'
  });

  console.log('App state initialized');

  // Initialize XC economy
  useEffect(() => {
    console.log('--- TEST ECONOMY EFFECT FIRING ---');
    xcEconomy.awardDailyLogin();
    setBalance(xcEconomy.getBalance());

    // Subscribe to XC balance updates
    const unsubscribe = xcEconomy.subscribe('balanceUpdated', (newBalance) => {
      setBalance(newBalance);
    });

    return unsubscribe;
  }, []);

  // ... existing code ...

  // FIX FOR "MIME TYPE" / "RESOURCE LOAD ERROR"
  // This detects if the browser is trying to load an old file that was deleted on deployment
  useEffect(() => {
    const handleChunkError = (event: ErrorEvent) => {
      const isChunkError = event.message && (
        event.message.includes('Failed to fetch dynamically imported module') ||
        event.message.includes('Importing a module script failed') ||
        event.message.includes('text/html') // The specific MIME error
      );

      if (isChunkError) {
        console.warn('♻️ New version detected. Reloading to get latest files...');

        // Prevent infinite reload loops
        if (!sessionStorage.getItem('version-reload-lock')) {
          sessionStorage.setItem('version-reload-lock', 'true');
          // Wait 5 seconds before clearing lock to allow reload to complete
          setTimeout(() => sessionStorage.removeItem('version-reload-lock'), 5000);

          // Force hard reload from server (bypass cache)
          window.location.reload();
        }
      }
    };

    window.addEventListener('error', handleChunkError);
    return () => window.removeEventListener('error', handleChunkError);
  }, []);

  // ... rest of your code ...

  // PWA Install Detection
  useEffect(() => {
    // Check if app is already installed
    setIsInstalled(window.matchMedia('(display-mode: standalone)').matches);

    // Listen for install prompt
    const handleBeforeInstallPrompt = (e: any) => {
      e.preventDefault();
      setInstallPrompt(e);
    };

    // Listen for app install
    const handleAppInstalled = () => {
      setIsInstalled(true);
      setInstallPrompt(null);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  // Handle PWA Install
  const handleInstallApp = async () => {
    if (!installPrompt) return;

    try {
      const result = await installPrompt.prompt();
      console.log('Install prompt result:', result);
      setInstallPrompt(null);
    } catch (error) {
      console.error('Install prompt failed:', error);
    }
  };

  // Initialize Real-time Radar Service
  useEffect(() => {
    console.log('📡 Initializing services...');
    const radarUnsubscribers: Array<() => void> = [];

    // iOS Debug: Removed iOS-specific fixes during cleanup
    // if (iOSFixes.isIOS || iOSFixes.isSafari) {
    //   setTimeout(() => {
    //     iOSFixes.debugBlankScreen();
    //   }, 2000);
    // }

    const initializeRadar = async () => {
      try {
        console.log('📡 Initializing real-time radar service...');

        // Try to connect to signaling server
        const connected = await realtimeRadar.initialize(); // Let radar service determine the correct URL

        if (connected) {
          setIsRealMode(true);
          console.log('✅ Real-time radar connected');

          // Subscribe to radar events
          radarUnsubscribers.push(realtimeRadar.subscribe('peersUpdated', (peers) => {
            console.log('📡 Radar peers updated:', peers);
            setRadarPeers(peers);
          }));

          radarUnsubscribers.push(realtimeRadar.subscribe('peerJoined', (peer) => {
            console.log('🆕 New radar peer:', peer);
            // Create transmission toast
            const event = new CustomEvent('newTransmission', {
              detail: {
                message: `RADAR: ${peer.name} (${peer.handle}) joined zone ${peer.location?.geohash || 'UNKNOWN'}`,
                type: 'system'
              }
            });
            window.dispatchEvent(event);
          }));

          radarUnsubscribers.push(realtimeRadar.subscribe('directMessage', (message) => {
            console.log('💬 Radar direct message:', message);
            // Handle incoming messages from radar peers
          }));

        } else {
          console.log('⚠️ Real-time radar unavailable, using simulation mode');
          setIsRealMode(false);
        }

      } catch (error) {
        // Suppress startup error for Pure Mesh Mode (offline is a valid state)
        console.warn('⚠️ Real-time radar server unavailable (Offline Mode active):', error);
        // Do NOT disable real mode - we want to stay in Mesh mode even if Radar is down
        setIsRealMode(true);
      }
    };

    initializeRadar();

    return () => {
      radarUnsubscribers.forEach((unsubscribe) => unsubscribe());
      realtimeRadar.destroy();
    };
  }, []);

  // Initialize Enhanced Discovery Service
  useEffect(() => {
    const initializeDiscovery = async () => {
      try {
        console.log('🔍 Initializing enhanced discovery service...');
        await enhancedDiscovery.startDiscovery();

        // Subscribe to discovery events
        enhancedDiscovery.subscribe('peersUpdated', (peers) => {
          console.log('📡 Discovered peers updated:', peers);
          setDiscoveredPeers(peers);
        });

        enhancedDiscovery.subscribe('peerConnected', (peer) => {
          console.log('✅ Peer connected via discovery:', peer);
          // Create chat window for newly connected peer
          const newUser: User = {
            id: peer.id,
            name: peer.name,
            handle: peer.handle,
            avatar: `https://picsum.photos/seed/${peer.id}/200`,
            status: 'Online',
            mood: 'Connected via mesh discovery'
          };
          handleOpenChat(newUser);
        });

      } catch (error) {
        console.error('❌ Failed to initialize enhanced discovery:', error);
      }
    };

    initializeDiscovery();

    return () => {
      enhancedDiscovery.stopDiscovery();
    };
  }, []);

  // Initialize Hybrid Mesh (Bluetooth first, WebRTC fallback)
  useEffect(() => {
    const initializeMesh = async () => {
      try {
        const initializedTypes = await hybridMesh.initialize();
        console.log('Hybrid mesh initialized with:', initializedTypes);

        // Start handshake persistence background maintenance
        handshakePersistence.startBackgroundMaintenance();

        // Subscribe to mesh messages
        hybridMesh.subscribe('messageReceived', (message) => {
          console.log('📨 Mesh message received:', message);

          // Support both 'from' (HybridMeshMessage) and 'senderId' (App Message) property names
          const senderId = message.from || message.senderId;

          if (senderId && senderId !== 'me') {
            // Record handshake for new peers
            let handshakeType: 'bluetooth' | 'wifi' | 'global' = 'global';
            if (message.connectionType === 'bluetooth') handshakeType = 'bluetooth';
            else if (message.connectionType === 'wifi' || message.connectionType === 'broadcast') handshakeType = 'wifi';

            const handshakeNode = handshakePersistence.recordHandshake({
              id: senderId,
              name: message.senderName || 'Unknown Node',
              handle: message.senderHandle || '@unknown',
              avatar: `https://picsum.photos/seed/${senderId}/200`,
              connectionType: handshakeType
            });

            // Find or create chat for this peer
            let targetChat = chats.find(c => c.participant.id === senderId);

            // If no chat exists, create one for radar peers
            if (!targetChat) {
              const radarPeer = radarPeers.find(p => p.id === senderId);
              if (radarPeer) {
                const newChat: Chat = {
                  id: Math.random().toString(36).substr(2, 9),
                  type: 'private',
                  participant: {
                    id: radarPeer.id,
                    name: radarPeer.name,
                    handle: radarPeer.handle,
                    avatar: radarPeer.avatar || `https://picsum.photos/seed/${radarPeer.id}/200`,
                    status: radarPeer.isOnline ? 'Online' : 'Away',
                    mood: 'Connected via radar',
                    moodEmoji: '📡',
                    reputation: 800,
                    distance: radarPeer.distance || 0
                  },
                  messages: [],
                  lastMessage: '',
                  unreadCount: 0
                };

                setChats(prev => [...prev, newChat]);
                targetChat = newChat;

                console.log(`🆕 Created chat for radar peer: ${radarPeer.handle}`);
              }
            }

            // Add message to chat if we have one
            if (targetChat) {
              const newMessage: Message = {
                id: message.id || Math.random().toString(36).substr(2, 9),
                senderId: senderId,
                senderHandle: message.senderHandle || targetChat.participant.handle,
                text: message.content,
                timestamp: message.timestamp || Date.now(),
                encryptedData: message.encryptedData
              };

              setChats(prev => prev.map(c =>
                c.id === targetChat.id
                  ? { ...c, messages: [...c.messages, newMessage], lastMessage: message.content }
                  : c
              ));

              console.log(`💬 Added message to chat ${targetChat.participant.handle}: ${message.content.substring(0, 30)}...`);
            }

            // Trigger transmission toast for new connections
            const event = new CustomEvent('newTransmission', {
              detail: {
                message: `📡 MESSAGE: ${handshakeNode.handle} via ${message.connectionType}`,
                type: 'message'
              }
            });
            window.dispatchEvent(event);
          }
        });

        hybridMesh.subscribe('peersUpdated', (peers) => {
          console.log('Mesh peers updated:', peers);

          // Update last seen for all current peers
          peers.forEach(peer => {
            handshakePersistence.updateLastSeen(peer.id);
          });
        });
      } catch (error) {
        console.error('Failed to initialize hybrid mesh:', error);
      }
    };

    initializeMesh();
  }, []);

  // Initialize Real TOR and POW Services
  useEffect(() => {
    const initializeSecurityServices = async () => {
      try {
        // Initialize TOR service
        const torEnabled = realTorService.getTorEnabled();
        console.log('TOR service enabled:', torEnabled);

        // Initialize POW service
        const powEnabled = realPowService.getPOWEnabled();
        console.log('POW service enabled:', powEnabled);

        // Subscribe to TOR status updates
        const unsubscribeTor = realTorService.subscribe('statusUpdated', (status) => {
          console.log('TOR status updated:', status);
        });

        const unsubscribeTorEnabled = realTorService.subscribe('enabled', () => {
          console.log('TOR enabled');
        });

        const unsubscribeTorDisabled = realTorService.subscribe('disabled', () => {
          console.log('TOR disabled');
        });

        // Subscribe to POW stats updates
        const unsubscribePow = realPowService.subscribe('statsUpdated', (stats) => {
          console.log('POW stats updated:', stats);
        });

        const unsubscribePowEnabled = realPowService.subscribe('enabled', () => {
          console.log('POW enabled');
        });

        const unsubscribePowDisabled = realPowService.subscribe('disabled', () => {
          console.log('POW disabled');
        });

        // Subscribe to marketplace updates
        const unsubscribeMarketplace = realMarketplaceService.subscribe('syncCompleted', (stats) => {
          console.log('Marketplace sync completed:', stats);
        });

        return () => {
          unsubscribeTor();
          unsubscribeTorEnabled();
          unsubscribeTorDisabled();
          unsubscribePow();
          unsubscribePowEnabled();
          unsubscribePowDisabled();
          unsubscribeMarketplace();
        };
      } catch (error) {
        console.error('Failed to initialize security services:', error);
      }
    };

    initializeSecurityServices();
  }, []);

  // Initialize Nostr Service
  useEffect(() => {
    let cleanupFuncs: (() => void)[] = [];

    const initializeNostr = async () => {
      try {
        console.log('🔑 Initializing Nostr service...');
        const success = nostrService.isConnected() ? true : await nostrService.initialize();

        if (success) {
          setNostrConnected(true);
          console.log('✅ Nostr service connected');

          // Subscribe to Nostr events
          const unsubMsg = nostrService.subscribe('messageReceived', (message) => {
            console.log('📨 Nostr message received:', message);
            // Convert Nostr message to app format and add to chats
            setChats(prev => {
              const nostrChat = prev.find(c => c.participant.id === `nostr-${message.from}`);
              if (nostrChat) {
                const newMessage: Message = {
                  id: message.id,
                  senderId: message.from,
                  text: message.content,
                  timestamp: message.timestamp.getTime(),
                  senderHandle: `nostr-${message.from.substring(0, 8)}`
                };

                return prev.map(c =>
                  c.id === nostrChat.id
                    ? { ...c, messages: [...c.messages, newMessage], lastMessage: message.content }
                    : c
                );
              }
              return prev;
            });
          });
          cleanupFuncs.push(unsubMsg);

          const unsubPeer = nostrService.subscribe('peerUpdated', (peer: NostrPeer) => {
            console.log('👤 Nostr peer updated:', peer);
            setNostrPeers(prev => {
              const filtered = prev.filter(p => p.id !== peer.id);
              return [...filtered, peer];
            });
          });
          cleanupFuncs.push(unsubPeer);

          const unsubProfile = nostrService.subscribe('profileLoaded', (profile) => {
            console.log('👤 Nostr profile loaded:', profile);
            if (profile.name) setMyHandle(profile.name);
            if (profile.picture) setMyAvatar(profile.picture);
            if (profile.about) setMyMood(prev => ({ ...prev, text: profile.about }));
            if (profile.custom_fields?.emoji) setMyMood(prev => ({ ...prev, emoji: profile.custom_fields.emoji }));
          });
          cleanupFuncs.push(unsubProfile);

          // Load initial peers
          const peers = nostrService.getPeers();
          setNostrPeers(peers);
        }
      } catch (error) {
        console.error('❌ Failed to initialize Nostr:', error);
        setNostrConnected(false);
      }
    };

    initializeNostr();

    return () => {
      cleanupFuncs.forEach(fn => fn());
    };
  }, []);

  const [myMood, setMyMood] = useState({ text: 'Connected to the matrix.', emoji: '⚡' });
  const [myAvatar, setMyAvatar] = useState('https://picsum.photos/seed/me/200');
  const [myHandle, setMyHandle] = useState('symbolic');
  const [uptime, setUptime] = useState(0);
  const [myLocation, setMyLocation] = useState<{ lat: number, lng: number } | null>(null);
  const [isSOSActive, setIsSOSActive] = useState(false);
  const [showWallet, setShowWallet] = useState(false);
  const [showProfile, setShowProfile] = useState(false);

  // Initialize Presence Beacon with room membership
  useEffect(() => {
    const initializePresenceBeacon = async () => {
      try {
        console.log('🗼 Initializing Presence Beacon with room membership...');

        // Initialize presence beacon with user info
        const userInfo = {
          name: myHandle || 'Anonymous',
          handle: myHandle?.replace('@', '') || 'anon'
        };

        await presenceBeacon.initialize(userInfo);
        await presenceBeacon.start();

        // Join default rooms
        presenceBeacon.joinRoom('global');
        presenceBeacon.joinRoom('local');

        console.log('✅ Presence Beacon initialized with room membership');
      } catch (error) {
        console.error('❌ Failed to initialize Presence Beacon:', error);
      }
    };

    initializePresenceBeacon();

    return () => {
      presenceBeacon.stop();
    };
  }, []);

  // Handle room membership based on current view
  useEffect(() => {
    if (!presenceBeacon.isConnected()) return;

    // Join room based on current view
    switch (view) {
      case 'rooms':
        presenceBeacon.joinRoom('rooms');
        break;
      case 'chats':
        presenceBeacon.joinRoom('chats');
        break;
      case 'map':
        presenceBeacon.joinRoom('radar');
        break;
      case 'buzz':
        presenceBeacon.joinRoom('buzz');
        break;
      case 'games':
        presenceBeacon.joinRoom('games');
        break;
      case 'tradepost':
      case 'joebanker':
        presenceBeacon.joinRoom('marketplace');
        break;
      default:
        // Leave specific rooms when navigating away
        ['rooms', 'chats', 'radar', 'buzz', 'games', 'marketplace'].forEach(room => {
          if (view !== room && view !== 'chats' && view !== 'map') {
            presenceBeacon.leaveRoom(room);
          }
        });
    }
  }, [view]);

  // Real-time Geolocation Watcher (Android-friendly)
  useEffect(() => {
    // Set default location immediately for better UX
    setMyLocation({ lat: -26.2041, lng: 28.0473 });

    let watchId: number | undefined;
    try {
      if ("geolocation" in navigator && navigator.geolocation) {
        watchId = navigator.geolocation.watchPosition(
          (pos) => {
            try {
              if (pos && pos.coords && pos.coords.latitude !== undefined && pos.coords.longitude !== undefined) {
                setMyLocation({
                  lat: pos.coords.latitude,
                  lng: pos.coords.longitude
                });
              }
            } catch (error) {
              // Silently ignore location setting errors
              console.log("Location update ignored:", error?.message || error);
            }
          },
          (err) => {
            // Silently handle location errors on mobile
            console.log("Location unavailable, using default:", err?.message || err);
          },
          { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 } // Less aggressive for mobile
        );
      }
    } catch (error) {
      // Silently ignore geolocation initialization errors
      console.log("Geolocation not available:", error?.message || error);
    }

    return () => {
      try {
        if (watchId !== undefined && navigator.geolocation && navigator.geolocation.clearWatch) {
          navigator.geolocation.clearWatch(watchId);
        }
      } catch (error) {
        // Silently ignore cleanup errors
        console.log("Error clearing geolocation watch:", error?.message || error);
      }
    };
  }, []);

  /*
  // Track Node Uptime
  useEffect(() => {
    const timer = setInterval(() => setUptime(prev => prev + 1), 1000);
    return () => clearInterval(timer);
  }, []);
  */

  // Simulated network transmissions
  // Simulated network transmissions REMOVED for Pure Mesh Mode
  // useEffect(() => { ... }, []);

  // Global event listener for custom transmissions
  useEffect(() => {
    const handleCustomTransmission = (event: CustomEvent) => {
      const newTransmission = {
        id: `custom-transmission-${Date.now()}`,
        message: event.detail.message,
        type: event.detail.type || 'system',
        timestamp: Date.now()
      };

      setTransmissions(prev => [...prev, newTransmission]);

      // Auto-remove after 6 seconds for custom transmissions
      setTimeout(() => {
        setTransmissions(prev => prev.filter(t => t.id !== newTransmission.id));
      }, 6000);
    };

    window.addEventListener('newTransmission', handleCustomTransmission as EventListener);

    return () => {
      window.removeEventListener('newTransmission', handleCustomTransmission as EventListener);
    };
  }, []);

  const handleRemoveTransmission = (id: string) => {
    setTransmissions(prev => prev.filter(t => t.id !== id));
  };

  useEffect(() => {
    startBootSequence();
  }, []);

  const startBootSequence = () => {
    setBootLogs([]);
    setIsBooting(true);
    const logs = [
      "XITCHAT_BOOT_LOADER System V",
      "CORE: initializing_kernel...",
      "MESH: establishing_peer_connections...",
      "AUTH: validating_node_identity...",
      "GPS: locking_geohash_sector_428F...",
      "SIGNAL: decrypting_incoming_packets...",
      "SUCCESS: xitchat_online."
    ];
    let i = 0;
    const interval = setInterval(() => {
      if (i < logs.length) {
        setBootLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] ${logs[i]}`]);
        i++;
      } else {
        clearInterval(interval);
        setTimeout(() => {
          setIsBooting(false);
          checkOnboardingStatus();
        }, 800);
      }
    }, 120);
  };

  const checkOnboardingStatus = () => {
    const onboarded = localStorage.getItem('xitchat_onboarded');
    const savedHandle = localStorage.getItem('xitchat_handle');
    const savedAvatar = localStorage.getItem('xitchat_avatar');
    const savedMood = localStorage.getItem('xitchat_mood');
    const savedUplinkCore = localStorage.getItem('xitchat_uplink_core');

    if (savedHandle) setMyHandle(savedHandle);
    if (savedAvatar) setMyAvatar(savedAvatar);
    if (savedMood) setMyMood(JSON.parse(savedMood));
    if (savedUplinkCore) {
      // Set uplink core in ProfileView state
      const event = new CustomEvent('setUplinkCore', { detail: savedUplinkCore });
      window.dispatchEvent(event);
    }

    if (!onboarded) {
      setShowOnboarding(true);
    } else if (!savedHandle || savedHandle === 'symbolic') {
      setView('profile');
    } else {
      setView('chats');
    }
  };

  const handleOnboardingComplete = () => {
    localStorage.setItem('xitchat_onboarded', 'true');
    setShowOnboarding(false);
    setView('profile');
  };

  const handleWipeNode = () => {
    if (confirm("DANGER: This will permanently wipe your node identity and mesh history. Proceed?")) {
      localStorage.removeItem('xitchat_onboarded');
      localStorage.removeItem('xitchat_handle');
      window.location.reload();
    }
  };

  const handleHandleChange = (val: string) => {
    const clean = val.replace(/[^a-z0-9_]/gi, '').toLowerCase();
    setMyHandle(clean);
    localStorage.setItem('xitchat_handle', clean);
  };

  const handleAvatarChange = (val: string) => {
    setMyAvatar(val);
    localStorage.setItem('xitchat_avatar', val);
    // Broadcast avatar change to friends
    broadcastProfileChange('avatar', val);
  };

  const handleMoodChange = (val: { text: string; emoji: string }) => {
    setMyMood(val);
    localStorage.setItem('xitchat_mood', JSON.stringify(val));
    // Broadcast mood change to friends
    broadcastProfileChange('mood', val);
  };

  const handleUplinkCoreChange = (val: string) => {
    localStorage.setItem('xitchat_uplink_core', val);
    // Broadcast uplink core change to friends
    broadcastProfileChange('uplinkCore', val);
  };

  const broadcastProfileChange = (type: string, value: any) => {
    // Create a system message to notify friends about profile changes
    const profileUpdateMessage: Message = {
      id: `profile-update-${Date.now()}`,
      senderId: 'system',
      text: `[PROFILE_UPDATE] ${myHandle} updated their ${type}`,
      timestamp: Date.now()
    };

    // Add the profile update message to all active chats
    setChats(prev => prev.map(chat => ({
      ...chat,
      messages: [...chat.messages, profileUpdateMessage],
      lastMessage: profileUpdateMessage.text
    })));

    // In a real implementation, this would sync with the mesh network
    console.log(`Broadcasting profile change: ${type} =`, value);
  };

  useEffect(() => {
    document.body.className = `theme-${isSOSActive ? 'red' : theme} crt`;
  }, [theme, isSOSActive]);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Sync room messages from geohash channels into chat windows in real time.
  useEffect(() => {
    const unsubscribeRoomMessages = geohashChannels.subscribe('messageReceived', (geoMessage: any) => {
      const roomId = geoMessage.channelId;
      if (!roomId) return;

      const incomingMessage: Message = {
        id: geoMessage.id || `room-msg-${Date.now()}`,
        senderId: geoMessage.nodeId || 'unknown',
        senderHandle: geoMessage.nodeHandle || '@unknown',
        text: geoMessage.content || '',
        timestamp: geoMessage.timestamp || Date.now()
      };

      setChats(prev => {
        const roomChatIndex = prev.findIndex(c => c.type === 'room' && c.participant.id === roomId);

        if (roomChatIndex === -1) {
          const newRoomChat: Chat = {
            id: `chat-${Date.now()}`,
            type: 'room',
            participant: {
              id: roomId,
              name: roomId.replace('xitchat-local-', ''),
              handle: `#${roomId.replace('xitchat-local-', '')}`,
              avatar: '',
              status: 'Online',
              mood: 'Mesh room active'
            },
            lastMessage: incomingMessage.text,
            unreadCount: 1,
            messages: [incomingMessage]
          };
          return [newRoomChat, ...prev];
        }

        const existing = prev[roomChatIndex];
        if (existing.messages.some(m => m.id === incomingMessage.id)) {
          return prev;
        }

        const updated = [...prev];
        updated[roomChatIndex] = {
          ...existing,
          lastMessage: incomingMessage.text,
          unreadCount: activeChatId === existing.id ? existing.unreadCount : existing.unreadCount + 1,
          messages: [...existing.messages, incomingMessage]
        };
        return updated;
      });
    });

    return () => unsubscribeRoomMessages();
  }, [activeChatId]);

  const activeChat = chats.find(c => c.id === activeChatId) || null;

  const handleOpenChat = (user: User) => {
    setSelectedUser(null);
    const existing = chats.find(c => c.participant.id === user.id);
    if (existing) {
      setActiveChatId(existing.id);
    } else {
      const newChat: Chat = {
        id: `chat-${Date.now()}`,
        type: 'private',
        participant: user,
        lastMessage: '',
        unreadCount: 0,
        messages: []
      };
      setChats(p => [newChat, ...p]);
      setActiveChatId(newChat.id);
    }
    setView('chats');
  };

  const handleSendMessage = useCallback(async (text: string, options?: { imageUrl?: string; videoUrl?: string; replyTo?: Message['replyTo'], nostrRecipient?: string, encryptedData?: any }) => {
    if (!activeChatId) return;
    const newMessage: Message = {
      id: Math.random().toString(36).substr(2, 9),
      senderId: 'me',
      senderHandle: myHandle,
      text,
      imageUrl: options?.imageUrl,
      videoUrl: options?.videoUrl,
      replyTo: options?.replyTo,
      timestamp: Date.now(),
      encryptedData: options?.encryptedData
    };

    const lastMsgPreview = options?.imageUrl ? "[IMAGE TRANSMISSION]" : options?.videoUrl ? "[VIDEO TRANSMISSION]" : text;

    setChats(prev => prev.map(c => (c.id === activeChatId ? { ...c, lastMessage: lastMsgPreview, messages: [...c.messages, newMessage] } : c)));

    // Send via Nostr if recipient is a Nostr user
    if (options?.nostrRecipient && nostrConnected) {
      try {
        const success = await nostrService.sendDirectMessage(options.nostrRecipient, text);
        if (success) {
          console.log('📤 Message sent via Nostr to:', options.nostrRecipient);
        }
      } catch (error) {
        console.error('❌ Failed to send Nostr message:', error);
      }
    }

    // Route room chat through geohash channels for cross-device room real-time updates.
    if (activeChat?.type === 'room' && !options?.imageUrl && !options?.videoUrl) {
      try {
        await geohashChannels.sendMessage(activeChat.participant.id, text, 'text');
      } catch (error) {
        console.error('Failed to send room message via geohash channels:', error);
      }
    } else {
      // Send message via hybrid mesh (Bluetooth first, WebRTC fallback)
      try {
        // Strip prefixes to get the raw mesh ID
        let meshTargetId = activeChat?.participant?.id;
        if (meshTargetId?.startsWith('nostr-')) {
          // For Nostr peers, we need to use the actual public key
          const nostrPeerId = meshTargetId.replace('nostr-', '');
          const nostrPeer = nostrPeers.find(p => p.id === nostrPeerId);

          // Use the publicKey field if available, otherwise use the id
          meshTargetId = nostrPeer?.publicKey || nostrPeerId;
        } else if (meshTargetId?.startsWith('node-')) {
          meshTargetId = meshTargetId.replace('node-', '');
        }

        await hybridMesh.sendMessage(text, meshTargetId, options?.encryptedData);
        console.log('Message sent via hybrid mesh:', { text, targetId: meshTargetId, encrypted: !!options?.encryptedData });
      } catch (error) {
        console.error('Failed to send via hybrid mesh:', error);
      }
    }

    // Sync message to mesh network
    await meshDataSync.syncChatMessage({
      chatId: activeChatId,
      message: newMessage,
      participant: activeChat?.participant
    });

    if (activeChat?.participant.id === 'xit-bot' && !options?.imageUrl && !options?.videoUrl) {
      const targetChatId = activeChatId;
      if (!targetChatId) return;

      const requestId = ++botRequestCounterRef.current;
      const botMessageId = `bot-stream-${requestId}`;
      const startedAt = Date.now();
      const providerStatus = hybridAI.getProviderStatus();
      const streamProvider = providerStatus.groqHealthy
        ? 'groq'
        : providerStatus.primary === 'gemini'
          ? 'gemini'
          : 'mesh';

      const placeholderMessage: Message = {
        id: botMessageId,
        senderId: 'xit-bot',
        text: '',
        timestamp: startedAt,
        isAi: true
      };

      setBotStreamState({ active: true, provider: streamProvider });

      setChats(prev => prev.map(c =>
        c.id === targetChatId
          ? { ...c, lastMessage: 'XitBot is typing...', messages: [...c.messages, placeholderMessage] }
          : c
      ));

      try {
        let latestText = '';
        const finalText = await streamXitBotResponse(text, (_token, fullText) => {
          latestText = fullText;
          setChats(prev => prev.map(c => {
            if (c.id !== targetChatId) return c;
            return {
              ...c,
              lastMessage: fullText || 'XitBot is typing...',
              messages: c.messages.map(m => (m.id === botMessageId ? { ...m, text: fullText } : m))
            };
          }));
        });

        const resolvedText = finalText || latestText || 'Sorry, I hit static in the mesh. Please try again.';
        setChats(prev => prev.map(c => {
          if (c.id !== targetChatId) return c;
          return {
            ...c,
            lastMessage: resolvedText,
            messages: c.messages.map(m => (m.id === botMessageId ? { ...m, text: resolvedText, timestamp: Date.now() } : m))
          };
        }));
      } catch (error) {
        console.error('Failed to stream bot response:', error);
        setChats(prev => prev.map(c => {
          if (c.id !== targetChatId) return c;
          const fallback = 'Signal dropped while generating response. Please retry.';
          return {
            ...c,
            lastMessage: fallback,
            messages: c.messages.map(m => (m.id === botMessageId ? { ...m, text: fallback, timestamp: Date.now() } : m))
          };
        }));
      } finally {
        setBotStreamState({ active: false, provider: streamProvider });
      }
    }
  }, [activeChatId, activeChat?.type, activeChat?.participant?.id, myHandle, nostrConnected, nostrPeers]);

  const handleDeleteMessage = useCallback((messageId: string) => {
    if (!activeChatId) return;

    setChats(prev => prev.map(chat => {
      if (chat.id === activeChatId) {
        const updatedMessages = chat.messages.filter(msg => msg.id !== messageId);
        const lastMessage = updatedMessages.length > 0
          ? updatedMessages[updatedMessages.length - 1].text
          : 'No messages';

        return {
          ...chat,
          messages: updatedMessages,
          lastMessage
        };
      }
      return chat;
    }));
  }, [activeChatId]);

  const handleForwardMessage = useCallback((message: Message, targetChatId: string) => {
    const fwdMessage: Message = {
      ...message,
      id: Math.random().toString(36).substr(2, 9),
      text: `[FWD] ${message.text}`,
      timestamp: Date.now(),
      senderId: 'me',
      senderHandle: myHandle
    };

    setChats(prev => prev.map(c => {
      if (c.id === targetChatId) {
        return {
          ...c,
          lastMessage: `[FWD] ${message.text}`,
          messages: [...c.messages, fwdMessage]
        };
      }
      return c;
    }));

    setActiveChatId(targetChatId);
    setView('chats');
  }, [myHandle]);

  const handleReaction = useCallback((chatId: string, messageId: string, emoji: string) => {
    setChats(prev => prev.map(c => {
      if (c.id === chatId) {
        return {
          ...c,
          messages: c.messages.map(m => {
            if (m.id === messageId) {
              const reactions = m.reactions || [];
              const existingReaction = reactions.find(r => r.emoji === emoji);

              let newReactions;
              if (existingReaction) {
                if (existingReaction.users.includes('me')) {
                  newReactions = reactions.map(r =>
                    r.emoji === emoji
                      ? { ...r, count: r.count - 1, users: r.users.filter(u => u !== 'me') }
                      : r
                  ).filter(r => r.count > 0);
                } else {
                  newReactions = reactions.map(r =>
                    r.emoji === emoji
                      ? { ...r, count: r.count + 1, users: [...r.users, 'me'] }
                      : r
                  );
                }
              } else {
                newReactions = [...reactions, { emoji, count: 1, users: ['me'] }];
              }

              return { ...m, reactions: newReactions };
            }
            return m;
          })
        };
      }
      return c;
    }));
  }, []);

  const handleClearChatHistory = useCallback((chatId: string) => {
    setChats(prev => prev.map(c => {
      if (c.id === chatId) {
        return {
          ...c,
          messages: [],
          lastMessage: '',
          unreadCount: 0
        };
      }
      return c;
    }));
  }, []);

  const triggerSOS = () => {
    setIsSOSActive(true);
  };

  const handleBuyItem = (name: string, price: number, itemTheme?: string) => {
    if (xcEconomy.spendXC(price, `Purchased: ${name}`, 'nodeshop')) {
      // Update balance
      setBalance(xcEconomy.getBalance());

      // Handle theme change if applicable
      if (itemTheme) {
        setTheme(itemTheme as any);
      }

      // Show success message
      alert(`PURCHASE_COMPLETE: ${name} added to your inventory!`);
    } else {
      alert('INSUFFICIENT_XC: Please earn more XC coins by participating in the app!');
    }
  };

  const handleMarketplaceContact = (handle: string) => {
    // Create a real user object from handle instead of using mock data
    const user: User = {
      id: `node-${handle}`,
      name: handle.substring(1),
      handle: handle,
      avatar: `https://picsum.photos/seed/${handle}/200`,
      status: 'Online',
      mood: 'Trading on the BBS.'
    };
    handleOpenChat(user as User);
    setTimeout(() => {
      handleSendMessage(`Yo ${handle}, I saw your post on the BBS. Is it still available?`);
    }, 500);
  };

  const handleNostrPeerChat = (peer: NostrPeer) => {
    const user: User = {
      id: `nostr-${peer.id}`,
      name: peer.name || `Nostr User`,
      handle: peer.nip05 || `@${peer.id.substring(0, 8)}`,
      avatar: peer.picture || `https://picsum.photos/seed/${peer.id}/200`,
      status: 'Online',
      mood: peer.about || 'Connected via Nostr'
    };
    handleOpenChat(user);
  };

  const handleSearchNostrUsers = async (query: string) => {
    if (!nostrConnected) return;

    try {
      const results = await nostrService.searchUsers(query);
      console.log(`🔍 Found ${results.length} Nostr users for "${query}"`);
      setNostrPeers(results);
    } catch (error) {
      console.error('❌ Failed to search Nostr users:', error);
    }
  };

  const renderServiceView = () => {
    switch (view) {
      case 'apps':
        const services = [
          { id: 'buzz', icon: 'fa-rss', label: 'The Buzz', color: 'text-amber-400', desc: 'Local news and gossip feed.' },
          { id: 'marketplace', icon: 'fa-users-viewfinder', label: 'Local Trade', color: 'text-green-400', desc: 'Community board for real items & meetups.' },
          { id: 'joebanker', icon: 'fa-piggy-bank', label: 'JoeBanker', color: 'text-[#00ff41]', desc: 'Manage your XC units.' },
          { id: 'xc_dashboard', icon: 'fa-coins', label: 'XC Economy', color: 'text-yellow-400', desc: 'View your XC balance and transactions.' },
          { id: 'tradepost', icon: 'fa-shop', label: 'Node Shop', color: 'text-cyan-400', desc: 'Official digital skins and node gear.' },
          { id: 'games', icon: 'fa-gamepad', label: 'Play Lounge', color: 'text-purple-400', desc: 'Retro arcade and gaming.' },
          { id: 'gallery', icon: 'fa-images', label: 'Pics Gallery', color: 'text-orange-400', desc: 'Shared node transmissions.' },
        ];
        return (
          <div className="flex-1 p-6 overflow-y-auto bg-black text-current animate-in fade-in zoom-in-95 duration-300">
            <div className="flex justify-between items-center mb-10 border-b border-current pb-4">
              <div>
                <h2 className="text-3xl font-bold uppercase tracking-tighter glow-text">hub_launch.bin</h2>
                <p className="text-[10px] font-bold opacity-50 uppercase tracking-[0.2em] mt-1 text-white/40">all_active_services</p>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 max-w-5xl mx-auto">
              {services.map(s => (
                <button
                  key={s.id}
                  onClick={() => setView(s.id as View)}
                  className="p-6 border border-current border-opacity-20 bg-[#050505] flex flex-col items-start text-left gap-4 hover:bg-white/[0.05] hover:border-opacity-100 transition-all group active:scale-95"
                >
                  <div className={`text-3xl ${s.color} group-hover:scale-110 transition-transform`}>
                    <i className={`fa-solid ${s.icon}`}></i>
                  </div>
                  <div>
                    <h3 className="text-lg font-bold uppercase tracking-tight text-white group-hover:text-white transition-colors">{s.label}</h3>
                    <p className="text-[10px] opacity-40 uppercase tracking-widest mt-1 text-white/50 group-hover:opacity-80 transition-opacity">{s.desc}</p>
                  </div>
                  <div className="mt-2 text-[8px] font-bold uppercase tracking-[0.3em] opacity-20 group-hover:opacity-100 flex items-center gap-2">
                    launch_subroutine <i className="fa-solid fa-arrow-right"></i>
                  </div>
                </button>
              ))}
            </div>
          </div>
        );
      case 'buzz': return <BuzzView onBack={() => setView('apps')} />;
      case 'marketplace': return <MarketplaceView onBack={() => setView('apps')} onContact={handleMarketplaceContact} />;
      case 'rooms': return <RoomsView onJoinRoom={(roomId) => {
        handleJoinRoom(roomId);
        setView('chats');
      }} />;
      case 'games': return <GamesView onWinXC={(amount) => {
        xcEconomy.addXC(amount, 'Game winnings', 'games');
        setBalance(xcEconomy.getBalance());
      }} onBack={() => setView('apps')} />;
      case 'tradepost':
        return (
          <NodeShopView
            balance={balance}
            onBuyItem={handleBuyItem}
            currentTheme={theme}
            onBack={() => setView('apps')}
          />
        );
      case 'joebanker':
        return <JoeBankerView onBack={() => setView('apps')} />;
      case 'xc_dashboard':
        return <XCDashboard balance={balance} onBack={() => setView('apps')} />;
      case 'gallery':
        return <GalleryView onBack={() => setView('apps')} />;
      case 'native':
        return <NativeFeaturesView onBack={() => setView('apps')} />;
      case 'nostr':
        return (
          <div className="flex-1 p-6 overflow-y-auto bg-black text-current animate-in fade-in zoom-in-95 duration-300">
            <div className="flex justify-between items-center mb-10 border-b border-current pb-4">
              <div>
                <h2 className="text-3xl font-bold uppercase tracking-tighter glow-text">nostr_network.bin</h2>
                <p className="text-[10px] font-bold opacity-50 uppercase tracking-[0.2em] mt-1 text-white/40">
                  {nostrConnected ? 'connected_to_global_mesh' : 'offline_mode'}
                </p>
              </div>
              <div className={`px-3 py-1 text-xs font-bold uppercase ${nostrConnected ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'} border border-current border-opacity-20`}>
                {nostrConnected ? 'ONLINE' : 'OFFLINE'}
              </div>
            </div>

            {/* Connection Status */}
            <div className="mb-8 p-4 border border-current border-opacity-20 bg-[#050505]">
              <div className="flex items-center gap-4 mb-4">
                <div className={`w-3 h-3 rounded-full ${nostrConnected ? 'bg-green-400 animate-pulse' : 'bg-red-400'}`}></div>
                <div>
                  <h3 className="text-sm font-bold uppercase">Network Status</h3>
                  <p className="text-xs opacity-60">
                    {nostrConnected ? `Connected to ${nostrService.getConnectionInfo().relayCount} relays` : 'Disconnected from Nostr network'}
                  </p>
                </div>
              </div>

              {nostrConnected && (
                <div className="text-xs font-mono opacity-40">
                  Public Key: <span className="text-[#00ff41]">{nostrService.getPublicKey()?.substring(0, 16)}...</span>
                </div>
              )}
            </div>

            {/* User Search */}
            <div className="mb-8">
              <h3 className="text-lg font-bold uppercase mb-4">search_nodes</h3>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Search Nostr users..."
                  className="flex-1 bg-black border border-current border-opacity-20 px-4 py-2 text-sm font-mono focus:outline-none focus:border-opacity-100"
                  onKeyPress={(e) => {
                    if (e.key === 'Enter' && e.currentTarget.value) {
                      handleSearchNostrUsers(e.currentTarget.value);
                      e.currentTarget.value = '';
                    }
                  }}
                />
                <button
                  onClick={() => {
                    const input = document.querySelector('input[placeholder="Search Nostr users..."]') as HTMLInputElement;
                    if (input?.value) {
                      handleSearchNostrUsers(input.value);
                      input.value = '';
                    }
                  }}
                  className="px-4 py-2 border border-current border-opacity-20 text-sm font-bold uppercase hover:bg-white/[0.05] active:scale-95 transition-all"
                >
                  Search
                </button>
              </div>
            </div>

            {/* Nostr Peers */}
            <div>
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-bold uppercase">active_nodes ({nostrPeers.length})</h3>
                <button
                  onClick={() => setShowQRDiscovery(!showQRDiscovery)}
                  className="px-3 py-1 text-xs bg-green-600 text-white rounded hover:bg-green-700 transition-colors"
                >
                  🔍 Discover
                </button>
              </div>
              <div className="space-y-2">
                {nostrPeers.length === 0 ? (
                  <p className="text-xs opacity-40 text-center py-8">No Nostr peers found. Search for users above.</p>
                ) : (
                  nostrPeers.map((peer) => (
                    <div
                      key={peer.id}
                      onClick={() => handleNostrPeerChat(peer)}
                      className="p-4 border border-current border-opacity-20 bg-[#050505] hover:bg-white/[0.05] cursor-pointer transition-all group"
                    >
                      <div className="flex items-center gap-4">
                        <img
                          src={peer.picture || `https://picsum.photos/seed/${peer.id}/200`}
                          alt={peer.name || 'Nostr User'}
                          className="w-12 h-12 rounded-full object-cover"
                        />
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <h4 className="font-bold text-sm group-hover:text-[#00ff41] transition-colors">
                              {peer.name || `Anonymous ${peer.id.substring(0, 8)}`}
                            </h4>
                            {peer.nip05 && (
                              <span className="text-xs opacity-40 font-mono">{peer.nip05}</span>
                            )}
                          </div>
                          <p className="text-xs opacity-60 mt-1">
                            {peer.about || 'No description available'}
                          </p>
                          <p className="text-xs opacity-40 font-mono mt-1">
                            {peer.id.substring(0, 16)}...
                          </p>
                        </div>
                        <div className="text-xs opacity-40">
                          <i className="fa-solid fa-message"></i>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* QR Discovery Modal */}
            {showQRDiscovery && (
              <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
                <div className="bg-black border border-green-500/30 rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
                  <div className="flex justify-between items-center p-4 border-b border-green-500/30">
                    <h3 className="text-xl font-bold text-green-400">🔗 Peer Discovery</h3>
                    <button
                      onClick={() => setShowQRDiscovery(false)}
                      className="text-gray-400 hover:text-white"
                    >
                      ✕
                    </button>
                  </div>
                  <div className="p-4">
                    <QRDiscovery onPeerConnected={(peer) => {
                      console.log('Peer connected via QR:', peer);
                      setShowQRDiscovery(false);
                    }} />
                  </div>
                </div>
              </div>
            )}

            {/* Discovered Peers */}
            {discoveredPeers.length > 0 && (
              <div>
                <h3 className="text-lg font-bold uppercase mb-4">discovered_peers ({discoveredPeers.length})</h3>
                <div className="space-y-2">
                  {discoveredPeers.map((peer) => (
                    <div
                      key={peer.id}
                      onClick={() => enhancedDiscovery.connectToPeer(peer.id)}
                      className={`p-4 border border-current border-opacity-20 bg-[#050505] hover:bg-white/[0.05] cursor-pointer transition-all group ${peer.isConnected ? 'border-green-500/50' : ''
                        }`}
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 bg-green-500/20 rounded-full flex items-center justify-center">
                          <span className="text-green-400 text-xs">
                            {peer.discoveryMethod === 'bluetooth' ? '📶' :
                              peer.discoveryMethod === 'local-network' ? '🌐' :
                                peer.discoveryMethod === 'qr-code' ? '📱' : '🔗'}
                          </span>
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-bold">{peer.name}</span>
                            <span className="text-xs opacity-60">{peer.handle}</span>
                            {peer.isConnected && (
                              <span className="text-xs bg-green-500/20 text-green-400 px-2 py-1 rounded">Connected</span>
                            )}
                          </div>
                          <div className="text-xs opacity-60">
                            {peer.discoveryMethod} • Last seen: {new Date(peer.lastSeen).toLocaleTimeString()}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        );
      default: return null;
    }
  };

  const handleJoinRoom = (roomId: string) => {
    const existing = chats.find(c => c.participant.id === roomId);
    if (existing) {
      setActiveChatId(existing.id);
    } else {
      // Get channel info to check encryption status
      const channel = (geohashChannels as any).channels.get(roomId);
      const roomHistory = geohashChannels.getChannelMessages(roomId);
      const mappedHistory: Message[] = roomHistory.map((m: any) => ({
        id: m.id,
        senderId: m.nodeId || 'unknown',
        senderHandle: m.nodeHandle || '@unknown',
        text: m.content || '',
        timestamp: m.timestamp || Date.now()
      }));

      const roomChat: Chat = {
        id: `chat-${Date.now()}`,
        type: 'room',
        participant: {
          id: roomId,
          name: channel?.name || roomId.replace('room-', '').replace('_', ' '),
          handle: channel ? `#${channel.name.toLowerCase().replace(/\s+/g, '_')}` : `#${roomId.replace('room-', '')}`,
          avatar: '',
          status: 'Online',
          mood: 'Connected node.'
        },
        lastMessage: mappedHistory.length > 0 ? mappedHistory[mappedHistory.length - 1].text : 'system: joined room.',
        unreadCount: 0,
        messages: mappedHistory.length > 0
          ? mappedHistory
          : [{ id: 'sys-1', senderId: 'system', text: `[SYSTEM] established connection to room_${roomId}`, timestamp: Date.now() }],
        isEncrypted: channel?.isEncrypted || false
      };
      setChats(prev => [roomChat, ...prev]);
      setActiveChatId(roomChat.id);
    }
  };

  if (isBooting) {
    return (
      <div className="h-full w-full bg-black flex items-center justify-center p-6 font-mono overflow-hidden">
        <div className="max-w-xl w-full">
          <div className="flex items-center gap-4 mb-8 text-[#00ff41] animate-pulse">
            <i className="fa-solid fa-ghost text-4xl"></i>
            <h1 className="text-4xl font-black uppercase tracking-tighter">XITCHAT_OS</h1>
          </div>
          <div className="space-y-1">
            {bootLogs.map((log, i) => (
              <p key={i} className="text-[10px] text-[#00ff41] opacity-70 animate-in fade-in slide-in-from-left-2">{log}</p>
            ))}
            <div className="w-2 h-4 bg-[#00ff41] animate-pulse mt-4"></div>
          </div>
        </div>
      </div>
    );
  }

  if (showOnboarding) {
    return <Onboarding onComplete={handleOnboardingComplete} />;
  }

  return (
    <div className="flex flex-col md:flex-row h-full w-full bg-black text-current overflow-hidden selection:bg-current selection:text-black pt-safe"
      style={{
        minHeight: '100dvh',
        WebkitOverflowScrolling: 'touch',
      }}>
      <Sidebar currentView={view} setView={setView} userAvatar={myAvatar} />
      <div className="flex-1 flex overflow-hidden relative md:pt-0 mobile-content-padding">

        {/* Transmission Toasts */}
        <TransmissionToast
          transmissions={transmissions}
          onRemove={handleRemoveTransmission}
        />

        {isSOSActive && (
          <div className="fixed inset-0 z-[200] bg-red-900/40 backdrop-blur-md flex flex-col items-center justify-center p-8 animate-[pulse_1.5s_infinite]">
            <div className="max-w-md w-full border-4 border-white bg-red-600 p-8 text-white shadow-[0_0_100px_#ff0000]">
              <h2 className="text-4xl font-black uppercase tracking-tighter mb-4 flex items-center gap-4">
                <i className="fa-solid fa-triangle-exclamation animate-bounce"></i> SOS_ACTIVE
              </h2>
              <p className="font-bold text-sm uppercase leading-relaxed mb-8">
                Emergency signal broadcast to all nodes in Sector 428F.
              </p>
              <button
                onClick={() => setIsSOSActive(false)}
                className="w-full bg-white text-red-600 py-6 uppercase font-black tracking-widest text-lg shadow-xl active:scale-95 transition-all"
              >
                DEACTIVATE_PROTOCOL
              </button>
            </div>
          </div>
        )}

        {view === 'chats' && (
          <>
            {/* Mobile: Show chat list when no active chat */}
            {isMobile && !activeChatId && (
              <div className="flex-1">
                <ChatList
                  chats={chats}
                  activeChatId={activeChatId}
                  onChatSelect={(id) => setActiveChatId(id)}
                  onInviteNode={() => setShowInviteModal(true)}
                />
              </div>
            )}

            {/* Desktop: Always show chat list */}
            {!isMobile && (
              <div className="w-80 border-r border-current border-opacity-20 bg-[#050505]">
                <ChatList
                  chats={chats}
                  activeChatId={activeChatId}
                  onChatSelect={(id) => setActiveChatId(id)}
                  onInviteNode={() => setShowInviteModal(true)}
                />
              </div>
            )}

            {/* Chat Window */}
            {activeChatId && (
              <ChatWindow
                chat={activeChat}
                allChats={chats}
                myHandle={myHandle}
                aiStreaming={botStreamState.active}
                aiStreamingProvider={botStreamState.provider}
                onSendMessage={handleSendMessage}
                onForwardMessage={handleForwardMessage}
                onReaction={(msgId, emoji) => handleReaction(activeChatId, msgId, emoji)}
                onDeleteMessage={handleDeleteMessage}
                onClearChatHistory={handleClearChatHistory}
                onClose={isMobile ? () => setActiveChatId(null) : undefined}
                className={isMobile ? "flex-1" : ""}
                nostrRecipient={activeChat?.participant.id.startsWith('nostr-') ? activeChat.participant.id.replace('nostr-', '') : undefined}
              />
            )}
          </>
        )}
        {view === 'map' && <MapView onUserSelect={(user) => setSelectedUser(user)} userLocation={myLocation} />}
        {['apps', 'buzz', 'marketplace', 'tradepost', 'joebanker', 'xc_dashboard', 'gallery', 'rooms', 'games', 'native', 'nostr'].includes(view) && renderServiceView()}

        {(view === 'profile' || view === 'settings') && (
          <ProfileView
            myHandle={myHandle}
            setMyHandle={handleHandleChange}
            myAvatar={myAvatar}
            setMyAvatar={setMyAvatar}
            myMood={myMood}
            setMyMood={setMyMood}
            uptime={uptime}
            balance={balance}
            theme={theme}
            setTheme={setTheme}
            onWipe={handleWipeNode}
            onSOS={triggerSOS}
            onClose={() => setView('chats')}
            onUplinkCoreChange={handleUplinkCoreChange}
            installPrompt={installPrompt}
            isInstalled={isInstalled}
            onInstallApp={handleInstallApp}
          />
        )}

        {/* Fix: Added missing Invite Modal UI */}
        {showInviteModal && (
          <div className="fixed inset-0 z-[100] bg-black/95 flex items-center justify-center p-6 animate-in fade-in">
            <div className="max-w-md w-full border-2 border-current bg-[#050505] p-8 shadow-[0_0_50px_currentColor] text-center">
              <h3 className="text-xl font-bold uppercase tracking-widest mb-6 glow-text">invite_peer.exe</h3>
              <p className="text-xs opacity-60 mb-8 italic">Scan your surroundings for active mesh nodes or share your node ID.</p>
              <div className="p-4 border border-current border-dashed mb-8">
                <p className="text-[10px] opacity-40 uppercase tracking-[0.3em] mb-2">your_node_id</p>
                <p className="text-lg font-black text-white">48F2-A812-{myHandle.toUpperCase()}</p>
              </div>
              <button onClick={() => setShowInviteModal(false)} className="terminal-btn active w-full py-4 uppercase font-bold text-xs tracking-widest">close_scanner</button>
            </div>
          </div>
        )}

        {selectedUser && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/95 backdrop-blur-md animate-in fade-in duration-300">
            <div className="max-w-xs w-full border-2 border-current border-opacity-30 bg-[#050505] p-8 relative">
              <button onClick={() => setSelectedUser(null)} className="absolute -top-4 -right-4 w-10 h-10 border-2 border-current bg-black flex items-center justify-center text-xl font-bold hover:bg-current hover:text-black transition-colors">X</button>
              <div className="flex flex-col items-center mb-8">
                <div className="w-32 h-32 border-2 border-current border-opacity-30 p-1 mb-4 relative bg-black">
                  <img src={selectedUser.avatar} className="w-full h-full object-cover grayscale" alt="" />
                  <div className="absolute -top-4 -right-4 text-4xl animate-bounce">{selectedUser.moodEmoji}</div>
                </div>
                <h3 className="text-2xl font-bold uppercase tracking-tighter glow-text text-white">&lt;{selectedUser.handle}&gt;</h3>
                <p className="text-[10px] opacity-40 font-bold uppercase tracking-widest mt-1 text-white/40">{selectedUser.status}</p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <button onClick={() => handleOpenChat(selectedUser)} className="terminal-btn active py-4 font-bold uppercase text-[10px] tracking-widest">message</button>
                <button className="terminal-btn py-4 font-bold uppercase text-[10px] tracking-widest" onClick={() => alert(`PING: Node ${selectedUser.handle} has been pinged.`)}>ping</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default App;
