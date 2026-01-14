import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';
import '../theme/app_theme.dart';
import '../services/xc_economy.dart';
import 'terminal_components.dart';

class UplinkCore {
  final String id;
  final IconData icon;
  final Color color;
  final String label;

  UplinkCore({
    required this.id,
    required this.icon,
    required this.color,
    required this.label,
  });
}

class ThemeOption {
  final String id;
  final String label;
  final Color color;

  ThemeOption({
    required this.id,
    required this.label,
    required this.color,
  });
}

class ProfileView extends StatefulWidget {
  final String handle;
  final int balance;
  final int connectedPeers;
  final bool isRealMode;
  final bool isDiscovering;
  final VoidCallback onToggleMode;
  final VoidCallback onStartDiscovery;
  final VoidCallback onStopDiscovery;
  final List<XCTransaction> transactions;
  final Set<String> achievements;
  final VoidCallback? onClose;
  final VoidCallback? onSOS;
  final VoidCallback? onWipe;

  const ProfileView({
    super.key,
    required this.handle,
    required this.balance,
    required this.connectedPeers,
    required this.isRealMode,
    required this.isDiscovering,
    required this.onToggleMode,
    required this.onStartDiscovery,
    required this.onStopDiscovery,
    required this.transactions,
    required this.achievements,
    this.onClose,
    this.onSOS,
    this.onWipe,
  });

  @override
  State<ProfileView> createState() => _ProfileViewState();
}

class _ProfileViewState extends State<ProfileView> {
  final ImagePicker _imagePicker = ImagePicker();
  String _avatar = '';
  String _moodText = 'active';
  final String _moodEmoji = '😎';
  String _selectedTheme = 'green';
  String _uplinkCore = 'ghost';
  bool _torEnabled = true;
  bool _powEnabled = false;
  String _appearance = 'dark';
  
  final List<UplinkCore> _uplinkCores = [
    UplinkCore(id: 'ghost', icon: Icons.person, color: AppTheme.primaryGreen, label: 'Ghost'),
    UplinkCore(id: 'robot', icon: Icons.smart_toy, color: Colors.cyan, label: 'Robot'),
    UplinkCore(id: 'mojie', icon: Icons.emoji_emotions, color: Colors.amber, label: 'Mojie'),
    UplinkCore(id: 'alien', icon: Icons.person, color: Colors.red, label: 'Alien'),
    UplinkCore(id: 'signal', icon: Icons.satellite_alt, color: AppTheme.primaryGreen, label: 'Signal'),
    UplinkCore(id: 'shield', icon: Icons.shield, color: AppTheme.primaryGreen, label: 'Shield'),
    UplinkCore(id: 'pulse', icon: Icons.favorite, color: Colors.red, label: 'Pulse'),
    UplinkCore(id: 'node', icon: Icons.hub, color: Colors.cyan, label: 'Node'),
    UplinkCore(id: 'star', icon: Icons.star, color: Colors.amber, label: 'Star'),
  ];
  
  final List<ThemeOption> _themes = [
    ThemeOption(id: 'green', label: 'MATRIX_GREEN', color: AppTheme.primaryGreen),
    ThemeOption(id: 'amber', label: 'AMBER_TERMINAL', color: Colors.amber),
    ThemeOption(id: 'cyan', label: 'CYBER_CYAN', color: Colors.cyan),
    ThemeOption(id: 'red', label: 'ALERT_RED', color: Colors.red),
  ];

  Future<void> _pickImage() async {
    try {
      final XFile? image = await _imagePicker.pickImage(source: ImageSource.gallery);
      if (image != null) {
        setState(() {
          _avatar = image.path;
        });
      }
    } catch (e) {
      debugPrint('Error picking image: $e');
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppTheme.background,
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Header with Version and Close
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const GlowText(text: 'xitchat', fontSize: 24),
                      const SizedBox(height: 4),
                      Text(
                        'v1.3.1',
                        style: TextStyle(
                          fontSize: 10,
                          color: AppTheme.primaryGreen.withAlpha((0.4 * 255).round()) ,
                          fontFamily: 'monospace',
                        ),
                      ),
                    ],
                  ),
                  if (widget.onClose != null)
                    GestureDetector(
                      onTap: widget.onClose,
                      child: const Text(
                        'CLOSE',
                        style: TextStyle(
                          color: AppTheme.primaryGreen,
                          fontSize: 12,
                          fontWeight: FontWeight.bold,
                          letterSpacing: 2,
                          fontFamily: 'monospace',
                        ),
                      ),
                    ),
                ],
              ),
              
              const SizedBox(height: 32),

              // Profile Identity Card
              _buildProfileIdentityCard(),
              
              const SizedBox(height: 40),

              // Feature Highlights
              _buildFeatureHighlights(),
              
              const SizedBox(height: 40),

              // Uplink Core Selection
              _buildUplinkCoreSelection(),
              
              const SizedBox(height: 40),

              // Node Appearance Settings
              _buildThemeSelection(),
              
              const SizedBox(height: 40),

              // Other Settings
              _buildOtherSettings(),
              
              const SizedBox(height: 40),

              // System Actions
              _buildSystemActions(),
            ],
          ),
        ),
      ),
    );
  }

  void _showWipeConfirmation(BuildContext context) {
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        backgroundColor: AppTheme.surface,
        title: const GlowText(text: 'WARNING', color: Colors.red),
        content: const Text(
          'This will erase all local data. Are you sure?',
          style: TextStyle(color: Colors.white),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('ABORT'),
          ),
          TextButton(
            onPressed: () {
              Navigator.pop(context);
              widget.onWipe?.call();
            },
            child: const Text('CONFIRM', style: TextStyle(color: Colors.red)),
          ),
        ],
      ),
    );
  }

  Widget _buildProfileIdentityCard() {
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: AppTheme.surface,
        border: Border.all(color: AppTheme.primaryGreen.withValues(alpha: 0.3)),
        borderRadius: BorderRadius.circular(8),
      ),
      child: Column(
        children: [
          Row(
            children: [
              // Avatar section
              GestureDetector(
                onTap: _pickImage,
                child: Container(
                  width: 80,
                  height: 80,
                  decoration: BoxDecoration(
                    border: Border.all(color: AppTheme.primaryGreen, width: 2),
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: _avatar.isNotEmpty
                      ? ClipRRect(
                          borderRadius: BorderRadius.circular(6),
                          child: Image.asset(_avatar, fit: BoxFit.cover),
                        )
                      : const Icon(Icons.person, size: 40, color: AppTheme.primaryGreen),
                ),
              ),
              const SizedBox(width: 16),
              
              // Handle and ID section
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.end,
                  children: [
                    Row(
                      mainAxisAlignment: MainAxisAlignment.end,
                      children: [
                        const Text(
                          'NODE:',
                          style: TextStyle(
                            color: AppTheme.primaryGreen,
                            fontSize: 10,
                            fontWeight: FontWeight.bold,
                            fontFamily: 'monospace',
                          ),
                        ),
                        const SizedBox(width: 8),
                        Text(
                          widget.handle.toUpperCase(),
                          style: const TextStyle(
                            color: Colors.white,
                            fontSize: 18,
                            fontWeight: FontWeight.bold,
                            fontFamily: 'monospace',
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 4),
                    const Text(
                      'ID: 48F2-A812',
                      style: TextStyle(
                        color: AppTheme.primaryGreen,
                        fontSize: 9,
                        fontWeight: FontWeight.bold,
                        fontFamily: 'monospace',
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
          
          const SizedBox(height: 20),
          
          // Mood broadcast section
          Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text(
                'BROADCAST_SIGNAL',
                style: TextStyle(
                  color: AppTheme.primaryGreen,
                  fontSize: 10,
                  fontWeight: FontWeight.bold,
                  fontFamily: 'monospace',
                ),
              ),
              const SizedBox(height: 8),
              Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: Colors.black,
                  border: Border.all(color: AppTheme.primaryGreen.withValues(alpha: 0.3)),
                ),
                child: Row(
                  children: [
                    Text(
                      _moodEmoji,
                      style: const TextStyle(fontSize: 20),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: TextField(
                        style: const TextStyle(
                          color: Colors.white,
                          fontSize: 12,
                          fontFamily: 'monospace',
                        ),
                        decoration: const InputDecoration(
                          hintText: 'broadcast_status...',
                          hintStyle: TextStyle(
                            color: AppTheme.primaryGreen,
                            fontFamily: 'monospace',
                          ),
                          border: InputBorder.none,
                        ),
                        onChanged: (value) {
                          setState(() {
                            _moodText = value;
                          });
                        },
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildFeatureHighlights() {
    return Column(
      children: [
        _buildFeatureItem(
          icon: Icons.bluetooth,
          title: 'Offline Mesh Chat',
          description: 'Communicate directly via Bluetooth LE without internet or servers.',
        ),
        const SizedBox(height: 24),
        _buildFeatureItem(
          icon: Icons.public,
          title: 'Online Geohash Channels',
          description: 'Connect with people in your area using geohash-based channels.',
        ),
      ],
    );
  }

  Widget _buildFeatureItem({
    required IconData icon,
    required String title,
    required String description,
  }) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        SizedBox(
          width: 24,
          height: 24,
          child: Icon(icon, color: AppTheme.primaryGreen, size: 20),
        ),
        const SizedBox(width: 20),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                title,
                style: const TextStyle(
                  color: Colors.white,
                  fontSize: 16,
                  fontWeight: FontWeight.bold,
                ),
              ),
              const SizedBox(height: 4),
              Text(
                description,
                style: const TextStyle(
                  color: AppTheme.primaryGreen,
                  fontSize: 12,
                  
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }

  Widget _buildUplinkCoreSelection() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Text(
          'UPLINK_CORE_SELECTION',
          style: TextStyle(
            color: AppTheme.primaryGreen,
            fontSize: 10,
            fontWeight: FontWeight.bold,
            fontFamily: 'monospace',
          ),
        ),
        const SizedBox(height: 16),
        GridView.builder(
          shrinkWrap: true,
          physics: const NeverScrollableScrollPhysics(),
          gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
            crossAxisCount: 3,
            childAspectRatio: 1,
            crossAxisSpacing: 12,
            mainAxisSpacing: 12,
          ),
          itemCount: _uplinkCores.length,
          itemBuilder: (context, index) {
            final core = _uplinkCores[index];
            final isSelected = _uplinkCore == core.id;
            
            return GestureDetector(
              onTap: () => setState(() => _uplinkCore = core.id),
              child: Container(
                decoration: BoxDecoration(
                  color: AppTheme.surface,
                  border: Border.all(
                    color: isSelected ? core.color : AppTheme.primaryGreen.withValues(alpha: 0.3),
                    width: isSelected ? 2 : 1,
                  ),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Icon(
                      core.icon,
                      color: core.color,
                      size: 24,
                    ),
                    const SizedBox(height: 8),
                    Text(
                      core.label,
                      style: TextStyle(
                        color: isSelected ? Colors.white : AppTheme.primaryGreen.withValues(alpha: 0.6),
                        fontSize: 10,
                        fontWeight: FontWeight.bold,
                        fontFamily: 'monospace',
                      ),
                    ),
                  ],
                ),
              ),
            );
          },
        ),
      ],
    );
  }

  Widget _buildThemeSelection() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Text(
          'NODE_APPEARANCE',
          style: TextStyle(
            color: AppTheme.primaryGreen,
            fontSize: 10,
            fontWeight: FontWeight.bold,
            fontFamily: 'monospace',
          ),
        ),
        const SizedBox(height: 16),
        GridView.builder(
          shrinkWrap: true,
          physics: const NeverScrollableScrollPhysics(),
          gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
            crossAxisCount: 2,
            childAspectRatio: 2.5,
            crossAxisSpacing: 12,
            mainAxisSpacing: 12,
          ),
          itemCount: _themes.length,
          itemBuilder: (context, index) {
            final theme = _themes[index];
            final isSelected = _selectedTheme == theme.id;
            
            return GestureDetector(
              onTap: () => setState(() => _selectedTheme = theme.id),
              child: Container(
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: AppTheme.surface,
                  border: Border.all(
                    color: isSelected ? theme.color : AppTheme.primaryGreen.withValues(alpha: 0.3),
                    width: isSelected ? 2 : 1,
                  ),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Row(
                  children: [
                    Container(
                      width: 14,
                      height: 14,
                      decoration: BoxDecoration(
                        color: theme.color,
                        shape: BoxShape.circle,
                        boxShadow: isSelected ? [BoxShadow(color: theme.color, blurRadius: 8)] : null,
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Text(
                        theme.label,
                        style: TextStyle(
                          color: isSelected ? Colors.white : AppTheme.primaryGreen.withValues(alpha: 0.6),
                          fontSize: 10,
                          fontWeight: FontWeight.bold,
                          fontFamily: 'monospace',
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            );
          },
        ),
      ],
    );
  }

  Widget _buildOtherSettings() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Text(
          'APPEARANCE',
          style: TextStyle(
            color: AppTheme.primaryGreen,
            fontSize: 10,
            fontWeight: FontWeight.bold,
            fontFamily: 'monospace',
          ),
        ),
        const SizedBox(height: 16),
        Row(
          children: ['system', 'light', 'dark'].map((mode) {
            final isSelected = _appearance == mode;
            return Padding(
              padding: const EdgeInsets.only(right: 8),
              child: GestureDetector(
                onTap: () => setState(() => _appearance = mode),
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                  decoration: BoxDecoration(
                    color: isSelected ? AppTheme.primaryGreen : Colors.transparent,
                    border: Border.all(color: AppTheme.primaryGreen),
                  ),
                  child: Text(
                    mode,
                    style: TextStyle(
                      color: isSelected ? Colors.black : AppTheme.primaryGreen,
                      fontSize: 11,
                      fontFamily: 'monospace',
                    ),
                  ),
                ),
              ),
            );
          }).toList(),
        ),
        
        const SizedBox(height: 32),
        
        const Text(
          'PROOF OF WORK',
          style: TextStyle(
            color: AppTheme.primaryGreen,
            fontSize: 10,
            fontWeight: FontWeight.bold,
            fontFamily: 'monospace',
          ),
        ),
        const SizedBox(height: 16),
        Row(
          children: [
            GestureDetector(
              onTap: () => setState(() => _powEnabled = false),
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                decoration: BoxDecoration(
                  color: !_powEnabled ? AppTheme.primaryGreen : Colors.transparent,
                  border: Border.all(color: AppTheme.primaryGreen),
                ),
                child: const Text(
                  'POW OFF',
                  style: TextStyle(
                    color: Colors.black,
                    fontSize: 11,
                    fontFamily: 'monospace',
                  ),
                ),
              ),
            ),
            const SizedBox(width: 8),
            GestureDetector(
              onTap: () => setState(() => _powEnabled = true),
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                decoration: BoxDecoration(
                  color: _powEnabled ? AppTheme.primaryGreen : Colors.transparent,
                  border: Border.all(color: AppTheme.primaryGreen),
                ),
                child: const Text(
                  'POW ON',
                  style: TextStyle(
                    color: Colors.black,
                    fontSize: 11,
                    fontFamily: 'monospace',
                  ),
                ),
              ),
            ),
          ],
        ),
        
        const SizedBox(height: 32),
        
        const Text(
          'NETWORK',
          style: TextStyle(
            color: AppTheme.primaryGreen,
            fontSize: 10,
            fontWeight: FontWeight.bold,
            fontFamily: 'monospace',
          ),
        ),
        const SizedBox(height: 16),
        Row(
          children: [
            GestureDetector(
              onTap: () => setState(() => _torEnabled = false),
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                decoration: BoxDecoration(
                  color: !_torEnabled ? AppTheme.primaryGreen : Colors.transparent,
                  border: Border.all(color: AppTheme.primaryGreen),
                ),
                child: const Text(
                  'TOR OFF',
                  style: TextStyle(
                    color: Colors.black,
                    fontSize: 11,
                    fontFamily: 'monospace',
                  ),
                ),
              ),
            ),
            const SizedBox(width: 8),
            GestureDetector(
              onTap: () => setState(() => _torEnabled = true),
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                decoration: BoxDecoration(
                  color: _torEnabled ? AppTheme.primaryGreen : Colors.transparent,
                  border: Border.all(color: AppTheme.primaryGreen),
                ),
                child: Row(
                  children: [
                    const Text(
                      'TOR ON',
                      style: TextStyle(
                        color: Colors.black,
                        fontSize: 11,
                        fontFamily: 'monospace',
                      ),
                    ),
                    if (_torEnabled) ...[
                      const SizedBox(width: 8),
                      Container(
                        width: 6,
                        height: 6,
                        decoration: const BoxDecoration(
                          color: Colors.black,
                          shape: BoxShape.circle,
                        ),
                      ),
                    ],
                  ],
                ),
              ),
            ),
          ],
        ),
      ],
    );
  }

  Widget _buildSystemActions() {
    return Column(
      children: [
        // Stats row
        Row(
          children: [
            Expanded(
              child: Container(
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: AppTheme.surface,
                  border: Border.all(color: AppTheme.primaryGreen.withValues(alpha: 0.3)),
                ),
                child: Column(
                  children: [
                    const Text(
                      'WALLET',
                      style: TextStyle(
                        color: AppTheme.primaryGreen,
                        fontSize: 8,
                        fontWeight: FontWeight.bold,
                        fontFamily: 'monospace',
                      ),
                    ),
                    Text(
                      '${widget.balance} XC',
                      style: const TextStyle(
                        color: Colors.white,
                        fontSize: 18,
                        fontWeight: FontWeight.bold,
                        fontFamily: 'monospace',
                      ),
                    ),
                  ],
                ),
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Container(
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: AppTheme.surface,
                  border: Border.all(color: AppTheme.primaryGreen.withValues(alpha: 0.3)),
                ),
                child: Column(
                  children: [
                    const Text(
                      'UPTIME',
                      style: TextStyle(
                        color: AppTheme.primaryGreen,
                        fontSize: 8,
                        fontWeight: FontWeight.bold,
                        fontFamily: 'monospace',
                      ),
                    ),
                    Text(
                      '${(DateTime.now().difference(DateTime(2024, 1, 1)).inMinutes / 60).floor()}m',
                      style: const TextStyle(
                        color: Colors.white,
                        fontSize: 18,
                        fontWeight: FontWeight.bold,
                        fontFamily: 'monospace',
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ],
        ),
        
        const SizedBox(height: 24),
        
        // Action buttons
        if (widget.onSOS != null)
          TerminalButton(
            text: 'EMERGENCY_SOS',
            onPressed: widget.onSOS!.call,
            isFullWidth: true,
            backgroundColor: Colors.red.withAlpha((0.2 * 255).round()),
            textColor: Colors.red,
          ),
        
        const SizedBox(height: 12),
        
        if (widget.onWipe != null)
          TerminalButton(
            text: 'WIPE_NODE_IDENTITY (FACTORY_RESET)',
            onPressed: () => _showWipeConfirmation(context),
            isFullWidth: true,
            backgroundColor: Colors.red.withValues(alpha: 0.1),
            textColor: Colors.red.withValues(alpha: 0.5),
          ),
      ],
    );
  }
}

class _SectionHeader extends StatelessWidget {
  final String title;
  const _SectionHeader({required this.title});

  @override
  Widget build(BuildContext context) {
    return Text(
      title,
      style: const TextStyle(
        color: AppTheme.darkGreen,
        fontSize: 10,
        fontWeight: FontWeight.bold,
        letterSpacing: 2,
        fontFamily: 'monospace',
      ),
    );
  }
}

class _StatCard extends StatelessWidget {
  final String label;
  final String value;
  const _StatCard({required this.label, required this.value});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: AppTheme.surface,
        border: Border.all(color: AppTheme.darkGreen.withOpacity(0.3)),
      ),
      child: Column(
        children: [
          Text(
            value,
            style: const TextStyle(
              color: AppTheme.primaryGreen,
              fontSize: 20,
              fontWeight: FontWeight.bold,
              fontFamily: 'monospace',
            ),
          ),
          const SizedBox(height: 4),
          Text(
            label,
            style: const TextStyle(
              color: AppTheme.darkGreen,
              fontSize: 8,
              letterSpacing: 1,
              fontFamily: 'monospace',
            ),
          ),
        ],
      ),
    );
  }
}

class _SettingsTile extends StatelessWidget {
  final String title;
  final String subtitle;
  final Widget trailing;

  const _SettingsTile({
    required this.title,
    required this.subtitle,
    required this.trailing,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(bottom: 8),
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      decoration: BoxDecoration(
        color: AppTheme.surface,
        border: Border.all(color: AppTheme.darkGreen.withOpacity(0.3)),
      ),
      child: Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  title,
                  style: const TextStyle(
                    color: Colors.white,
                    fontSize: 14,
                    fontFamily: 'monospace',
                  ),
                ),
                Text(
                  subtitle,
                  style: const TextStyle(
                    color: AppTheme.darkGreen,
                    fontSize: 10,
                    letterSpacing: 1,
                    fontFamily: 'monospace',
                  ),
                ),
              ],
            ),
          ),
          trailing,
        ],
      ),
    );
  }
}
