import 'package:flutter/material.dart';
import 'package:permission_handler/permission_handler.dart';
import 'package:geolocator/geolocator.dart';
import '../theme/app_theme.dart';
import 'terminal_components.dart';

class OnboardingView extends StatefulWidget {
  final VoidCallback onComplete;

  const OnboardingView({
    super.key,
    required this.onComplete,
  });

  @override
  State<OnboardingView> createState() => _OnboardingViewState();
}

class _OnboardingViewState extends State<OnboardingView> {
  bool _isRequesting = false;

  void _handleGrantPermissions() async {
    setState(() => _isRequesting = true);

    try {
      // Request Location Permission
      try {
        LocationPermission permission = await Geolocator.requestPermission();
        if (permission == LocationPermission.denied || permission == LocationPermission.deniedForever) {
          debugPrint('Location permission denied');
        }
      } catch (e) {
        debugPrint('Location permission error: $e');
      }

      // Request Bluetooth Permission
      try {
        if (await Permission.bluetooth.isGranted) {
          debugPrint('Bluetooth already granted');
        } else {
          var status = await Permission.bluetooth.request();
          debugPrint('Bluetooth permission: $status');
        }
      } catch (e) {
        debugPrint('Bluetooth permission error: $e');
      }

      // Request Notification Permission
      try {
        if (await Permission.notification.isGranted) {
          debugPrint('Notifications already granted');
        } else {
          var status = await Permission.notification.request();
          debugPrint('Notification permission: $status');
        }
      } catch (e) {
        debugPrint('Notification permission error: $e');
      }

      // Request Phone (for background processing on Android)
      try {
        if (await Permission.phone.isGranted) {
          debugPrint('Phone permission already granted');
        } else {
          var status = await Permission.phone.request();
          debugPrint('Phone permission: $status');
        }
      } catch (e) {
        debugPrint('Phone permission error: $e');
      }

      // Simulate battery optimization check
      await Future.delayed(const Duration(seconds: 1));

      // Mark as onboarded
      await Future.delayed(const Duration(milliseconds: 500));
      widget.onComplete();
    } catch (e) {
      debugPrint('Permission handshake completed/skipped: $e');
      widget.onComplete();
    } finally {
      setState(() => _isRequesting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppTheme.background,
      body: SafeArea(
        child: Column(
          children: [
            // Scrollable Content
            Expanded(
              child: SingleChildScrollView(
                padding: const EdgeInsets.all(24),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const SizedBox(height: 20),
                    
                    // Brand Header
                    const Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        GlowText(text: 'xitchat', fontSize: 32),
                        SizedBox(height: 8),
                        Text(
                          'decentralized mesh messaging with end-to-end encryption',
                          style: TextStyle(
                            color: AppTheme.primaryGreen,
                            fontSize: 12,
                            fontFamily: 'monospace',
                          ),
                        ),
                      ],
                    ),
                    
                    const SizedBox(height: 40),
                    
                    // Privacy Card
                    Container(
                      padding: const EdgeInsets.all(20),
                      decoration: BoxDecoration(
                        color: AppTheme.surface,
                        borderRadius: BorderRadius.circular(12),
                        border: Border.all(color: AppTheme.primaryGreen.withAlpha((0.2 * 255).round())),
                      ),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const Row(
                            children: [
                            Icon(
                              Icons.security,
                              color: AppTheme.primaryGreen,
                              size: 20,
                            ),
                            SizedBox(width: 12),
                            Text(
                              'Your Privacy is Protected',
                              style: TextStyle(
                                color: AppTheme.primaryGreen,
                                fontSize: 16,
                                fontWeight: FontWeight.bold,
                                fontFamily: 'monospace',
                              ),
                            ),
                          ],
                        ),
                          const SizedBox(height: 16),
                          _buildPrivacyPoint('no tracking or data collection'),
                          _buildPrivacyPoint('Bluetooth mesh chats are fully offline'),
                          _buildPrivacyPoint('Geohash chats use the internet'),
                        ],
                      ),
                    ),
                    
                    const SizedBox(height: 40),
                    
                    // Permissions Header
                    const Text(
                      'PERMISSIONS',
                      style: TextStyle(
                        color: AppTheme.primaryGreen,
                        fontSize: 12,
                        fontWeight: FontWeight.bold,
                        letterSpacing: 2,
                        fontFamily: 'monospace',
                      ),
                    ),
                    
                    const SizedBox(height: 32),
                    
                    // Permission Items
                    _buildPermissionItem(
                      icon: Icons.bluetooth,
                      title: 'Nearby Devices',
                      description: 'Required to discover xitchat users via Bluetooth',
                    ),
                    
                    const SizedBox(height: 32),
                    
                    _buildPermissionItem(
                      icon: Icons.location_on,
                      title: 'Precise Location',
                      description: 'Required by Android to discover nearby xitchat users via Bluetooth',
                      warning: 'xitchat does NOT track your location',
                    ),
                    
                    const SizedBox(height: 32),
                    
                    _buildPermissionItem(
                      icon: Icons.notifications,
                      title: 'Notifications',
                      description: 'Receive notifications when you receive private messages',
                    ),
                    
                    const SizedBox(height: 32),
                    
                    _buildPermissionItem(
                      icon: Icons.battery_charging_full,
                      title: 'Battery Optimization',
                      description: 'Disable battery optimization to ensure xitchat runs reliably in the background',
                    ),
                  ],
                ),
              ),
            ),
            
            // Fixed Bottom Button
            Container(
              padding: const EdgeInsets.all(24),
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  begin: Alignment.bottomCenter,
                  end: Alignment.topCenter,
                  colors: [
                    AppTheme.background,
                    AppTheme.background.withAlpha((0.95 * 255).round()),
                    Colors.transparent,
                  ],
                ),
              ),
              child: TerminalButton(
                text: _isRequesting ? 'REQUESTING...' : 'GRANT PERMISSIONS',
                onPressed: _handleGrantPermissions,
                isFullWidth: true,
                isActive: !_isRequesting,
                backgroundColor: Colors.transparent,
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildPrivacyPoint(String text) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            '•',
            style: TextStyle(
              color: AppTheme.primaryGreen,
              fontSize: 12,
            ),
          ),
          const SizedBox(width: 8),
          Expanded(
            child: Text(
              text,
              style: const TextStyle(
                color: AppTheme.primaryGreen,
                fontSize: 11,
                fontFamily: 'monospace',
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildPermissionItem({
    required IconData icon,
    required String title,
    required String description,
    String? warning,
  }) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Container(
          width: 24,
          height: 24,
          decoration: BoxDecoration(
            color: AppTheme.primaryGreen.withValues(alpha: 0.1),
            borderRadius: BorderRadius.circular(6),
          ),
          child: Icon(
            icon,
            color: AppTheme.primaryGreen,
            size: 16,
          ),
        ),
        const SizedBox(width: 20),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                title,
                style: const TextStyle(
                  color: AppTheme.primaryGreen,
                  fontSize: 16,
                  fontWeight: FontWeight.bold,
                  fontFamily: 'monospace',
                ),
              ),
              const SizedBox(height: 8),
              Text(
                description,
                style: const TextStyle(
                  color: AppTheme.primaryGreen,
                  fontSize: 12,
                  fontFamily: 'monospace',
                ),
              ),
              if (warning != null) ...[
                const SizedBox(height: 8),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                  decoration: BoxDecoration(
                    color: Colors.orange.withValues(alpha: 0.1),
                    borderRadius: BorderRadius.circular(4),
                    border: Border.all(color: Colors.orange.withValues(alpha: 0.3)),
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      const Icon(
                        Icons.warning,
                        color: Colors.orange,
                        size: 12,
                      ),
                      const SizedBox(width: 4),
                      Text(
                        warning,
                        style: const TextStyle(
                          color: Colors.orange,
                          fontSize: 10,
                          fontWeight: FontWeight.bold,
                          fontFamily: 'monospace',
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ],
          ),
        ),
      ],
    );
  }
}
