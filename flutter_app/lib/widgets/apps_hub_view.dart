import 'package:flutter/material.dart';
import '../theme/app_theme.dart';
import 'terminal_components.dart';

class AppsHubView extends StatelessWidget {
  final int balance;
  final Function(String) onNavigateToService;

  const AppsHubView({
    super.key,
    required this.balance,
    required this.onNavigateToService,
  });

  @override
  Widget build(BuildContext context) {
    final services = [
      _ServiceItem(id: 'buzz', icon: Icons.rss_feed, label: 'The Buzz', color: Colors.amber, desc: 'Local news and gossip feed.'),
      _ServiceItem(id: 'marketplace', icon: Icons.people, label: 'Local Trade', color: AppTheme.primaryGreen, desc: 'Community board for real items & meetups.'),
      _ServiceItem(id: 'games', icon: Icons.sports_esports, label: 'Play Lounge', color: Colors.purple, desc: 'Retro arcade and gaming.'),
      _ServiceItem(id: 'gallery', icon: Icons.photo_library, label: 'Pics Gallery', color: Colors.orange, desc: 'Shared node transmissions.'),
      _ServiceItem(id: 'native', icon: Icons.smartphone, label: 'Native Features', color: Colors.blue, desc: 'Capacitor device hardware integration.'),
    ];

    return Container(
      color: AppTheme.background,
      child: Column(
        children: [
          // Header
          Container(
            padding: const EdgeInsets.all(16),
            decoration: const BoxDecoration(
              border: Border(
                bottom: BorderSide(color: AppTheme.darkGreen, width: 1),
              ),
            ),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                const Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    GlowText(text: 'xitchat', fontSize: 20),
                    SizedBox(height: 4),
                    Text(
                      'APPS_HUB_V2',
                      style: TextStyle(
                        fontSize: 9,
                        color: AppTheme.darkGreen,
                        letterSpacing: 2,
                        fontFamily: 'monospace',
                      ),
                    ),
                  ],
                ),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                  decoration: BoxDecoration(
                    border: Border.all(color: AppTheme.primaryGreen.withAlpha((0.2 * 255).round())),
                    color: AppTheme.primaryGreen.withAlpha((0.1 * 255).round()),
                  ),
                  child: Row(
                    children: [
                      const Icon(Icons.monetization_on, size: 14, color: AppTheme.primaryGreen),
                      const SizedBox(width: 6),
                      Text(
                        '$balance XC',
                        style: const TextStyle(
                          color: AppTheme.primaryGreen,
                          fontWeight: FontWeight.bold,
                          fontSize: 12,
                          fontFamily: 'monospace',
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
          // Services Grid
          Expanded(
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: GridView.builder(
                gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                  crossAxisCount: 2,
                  crossAxisSpacing: 12,
                  mainAxisSpacing: 12,
                  childAspectRatio: 1.1,
                ),
                itemCount: services.length,
                itemBuilder: (context, index) {
                  final service = services[index];
                  return _ServiceCard(
                    service: service,
                    onTap: () => onNavigateToService(service.id),
                  );
                },
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _ServiceItem {
  final String id;
  final IconData icon;
  final String label;
  final Color color;
  final String desc;

  _ServiceItem({
    required this.id,
    required this.icon,
    required this.label,
    required this.color,
    required this.desc,
  });
}

class _ServiceCard extends StatelessWidget {
  final _ServiceItem service;
  final VoidCallback onTap;

  const _ServiceCard({required this.service, required this.onTap});

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: AppTheme.surface,
          border: Border.all(color: AppTheme.darkGreen.withAlpha((0.3 * 255).round())),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Icon(service.icon, color: service.color, size: 28),
            const SizedBox(height: 12),
            Text(
              service.label.toUpperCase(),
              style: const TextStyle(
                color: Colors.white,
                fontWeight: FontWeight.bold,
                fontSize: 12,
                fontFamily: 'monospace',
              ),
            ),
            const SizedBox(height: 4),
            Text(
              service.desc,
              style: TextStyle(
                color: AppTheme.primaryGreen.withAlpha((0.6 * 255).round()),
                fontSize: 9,
                fontFamily: 'monospace',
              ),
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
            ),
          ],
        ),
      ),
    );
  }
}

