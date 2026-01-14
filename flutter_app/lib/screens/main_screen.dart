import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../providers/app_provider.dart';
import '../theme/app_theme.dart';
import '../widgets/chat_view.dart';
import '../widgets/radar_view.dart';
import '../widgets/rooms_view.dart';
import '../widgets/apps_hub_view.dart';
import '../widgets/profile_view.dart';
import '../widgets/joe_banker_view.dart';
import '../widgets/xc_dashboard_full.dart';
import '../widgets/gallery_view.dart';
import '../widgets/native_features_view.dart';

class MainScreen extends StatefulWidget {
  const MainScreen({super.key});

  @override
  State<MainScreen> createState() => _MainScreenState();
}

class _MainScreenState extends State<MainScreen> {
  int _currentIndex = 0;

  // Navigation items matching web Sidebar.tsx
  final List<_NavItem> _navItems = [
    _NavItem(icon: Icons.message, label: 'mesh'),
    _NavItem(icon: Icons.gps_fixed, label: 'radar'),
    _NavItem(icon: Icons.group, label: 'rooms'),
    _NavItem(icon: Icons.grid_view, label: 'apps'),
    _NavItem(icon: Icons.person, label: 'id'),
  ];

  @override
  Widget build(BuildContext context) {
    return Consumer<AppProvider>(
      builder: (context, appProvider, child) {
        return Scaffold(
          backgroundColor: AppTheme.background,
          body: SafeArea(
            child: IndexedStack(
              index: _currentIndex,
              children: [
                // Mesh (Chats)
                ChatView(
                  chats: appProvider.chats,
                  messages: appProvider.messages,
                  onSendMessage: appProvider.sendMessage,
                  onAddReaction: appProvider.addReaction,
                ),
                // Radar (Map)
                RadarView(
                  peers: appProvider.discoveredPeers,
                  connectedPeers: appProvider.connectedPeers,
                  isRealMode: appProvider.isRealMode,
                  onConnectPeer: appProvider.connectToPeer,
                  onDisconnectPeer: appProvider.disconnectFromPeer,
                  onToggleMode: appProvider.toggleDiscoveryMode,
                  isDiscovering: appProvider.isDiscovering,
                  onStartDiscovery: appProvider.startDiscovery,
                  onStopDiscovery: appProvider.stopDiscovery,
                  onUserSelect: (user) {
                    // Navigate to chat tab
                    setState(() {
                      _currentIndex = 0;
                    });
                  },
                ),
                // Rooms
                RoomsView(
                  rooms: appProvider.getRooms(),
                  onCreateRoom: appProvider.createRoom,
                  onJoinRoom: appProvider.joinRoom,
                ),
                // Apps Hub
                AppsHubView(
                  balance: appProvider.currentBalance,
                  onNavigateToService: (service) {
                    // Handle service navigation
                    if (service == 'joe_banker') {
                      Navigator.push(
                        context,
                        MaterialPageRoute(builder: (context) => const JoeBankerView()),
                      );
                    } else if (service == 'xc_dashboard') {
                      Navigator.push(
                        context,
                        MaterialPageRoute(builder: (context) => const XCDashboardFull()),
                      );
                    } else if (service == 'gallery') {
                      Navigator.push(
                        context,
                        MaterialPageRoute(builder: (context) => const GalleryView()),
                      );
                    } else if (service == 'native_features') {
                      Navigator.push(
                        context,
                        MaterialPageRoute(builder: (context) => const NativeFeaturesView()),
                      );
                    }
                  },
                ),
                // Profile/ID
                ProfileView(
                  handle: appProvider.currentUser?.handle ?? 'anonymous',
                  balance: appProvider.currentBalance,
                  connectedPeers: appProvider.connectedPeers.length,
                  isRealMode: appProvider.isRealMode,
                  isDiscovering: appProvider.isDiscovering,
                  onToggleMode: appProvider.toggleDiscoveryMode,
                  onStartDiscovery: appProvider.startDiscovery,
                  onStopDiscovery: appProvider.stopDiscovery,
                  transactions: appProvider.getTransactions(),
                  achievements: appProvider.getAchievements(),
                ),
              ],
            ),
          ),
          bottomNavigationBar: _buildBottomNav(),
        );
      },
    );
  }

  Widget _buildBottomNav() {
    return Container(
      height: 72,
      decoration: const BoxDecoration(
        color: AppTheme.background,
        border: Border(
          top: BorderSide(color: AppTheme.darkGreen, width: 1),
        ),
      ),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceAround,
        children: List.generate(_navItems.length, (index) {
          final item = _navItems[index];
          final isActive = _currentIndex == index;

          return Expanded(
            child: GestureDetector(
              onTap: () => setState(() => _currentIndex = index),
              child: Container(
                color: Colors.transparent,
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    // Active pill indicator at top
                    AnimatedContainer(
                      duration: const Duration(milliseconds: 200),
                      height: 3,
                      width: isActive ? 40 : 0,
                      margin: const EdgeInsets.only(bottom: 8),
                      decoration: BoxDecoration(
                        color: AppTheme.primaryGreen,
                        borderRadius: const BorderRadius.vertical(
                          bottom: Radius.circular(4),
                        ),
                        boxShadow: isActive
                            ? [
                                BoxShadow(
                                  color: AppTheme.primaryGreen.withOpacity(0.6),
                                  blurRadius: 12,
                                  spreadRadius: 2,
                                ),
                              ]
                            : null,
                      ),
                    ),
                    // Icon with optional glow
                    Container(
                      padding: const EdgeInsets.all(6),
                      decoration: BoxDecoration(
                        color: isActive
                            ? Colors.white.withOpacity(0.05)
                            : Colors.transparent,
                        borderRadius: BorderRadius.circular(12),
                      ),
                      child: Icon(
                        item.icon,
                        size: 22,
                        color: isActive
                            ? AppTheme.primaryGreen
                            : AppTheme.darkGreen,
                        shadows: isActive
                            ? [
                                Shadow(
                                  color: AppTheme.primaryGreen.withOpacity(0.8),
                                  blurRadius: 10,
                                ),
                              ]
                            : null,
                      ),
                    ),
                    const SizedBox(height: 4),
                    // Label
                    Text(
                      item.label.toUpperCase(),
                      style: TextStyle(
                        fontSize: 8,
                        fontWeight: FontWeight.bold,
                        letterSpacing: 1.5,
                        color: isActive
                            ? AppTheme.primaryGreen
                            : AppTheme.darkGreen.withOpacity(0.6),
                        fontFamily: 'monospace',
                      ),
                    ),
                  ],
                ),
              ),
            ),
          );
        }),
      ),
    );
  }
}

class _NavItem {
  final IconData icon;
  final String label;

  _NavItem({required this.icon, required this.label});
}
