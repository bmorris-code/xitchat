import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../providers/app_provider.dart';
import '../theme/app_theme.dart';

class XCDashboardFull extends StatefulWidget {
  const XCDashboardFull({super.key});

  @override
  State<XCDashboardFull> createState() => _XCDashboardFullState();
}

class _XCDashboardFullState extends State<XCDashboardFull> with TickerProviderStateMixin {
  late TabController _tabController;

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 3, vsync: this);
  }

  @override
  void dispose() {
    _tabController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Consumer<AppProvider>(
      builder: (context, appProvider, child) {
        return Scaffold(
          backgroundColor: AppTheme.background,
          appBar: AppBar(
            title: const Text('XC DASHBOARD'),
            backgroundColor: AppTheme.background,
            elevation: 0,
            bottom: TabBar(
              controller: _tabController,
              indicatorColor: AppTheme.primaryGreen,
              labelColor: AppTheme.primaryGreen,
              unselectedLabelColor: AppTheme.darkGreen,
              tabs: const [
                Tab(text: 'OVERVIEW'),
                Tab(text: 'ACTIVITY'),
                Tab(text: 'ACHIEVEMENTS'),
              ],
            ),
          ),
          body: TabBarView(
            controller: _tabController,
            children: [
              _buildOverviewTab(appProvider),
              _buildActivityTab(appProvider),
              _buildAchievementsTab(appProvider),
            ],
          ),
        );
      },
    );
  }

  Widget _buildOverviewTab(AppProvider appProvider) {
    return SingleChildScrollView(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Main Balance Card
          _buildMainBalanceCard(appProvider),
          const SizedBox(height: 24),
          
          // Quick Stats
          _buildQuickStats(appProvider),
          const SizedBox(height: 24),
          
          // Recent Activity
          _buildRecentActivity(appProvider),
          const SizedBox(height: 24),
          
          // XC Economy Info
          _buildEconomyInfo(),
        ],
      ),
    );
  }

  Widget _buildMainBalanceCard(AppProvider appProvider) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(24),
      decoration: BoxDecoration(
        gradient: LinearGradient(
          colors: [
            AppTheme.primaryGreen.withOpacity(0.3),
            AppTheme.primaryGreen.withOpacity(0.1),
          ],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        border: Border.all(color: AppTheme.primaryGreen, width: 2),
        borderRadius: BorderRadius.circular(20),
        boxShadow: [
          BoxShadow(
            color: AppTheme.primaryGreen.withOpacity(0.3),
            blurRadius: 20,
            spreadRadius: 2,
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              const Text(
                'XC BALANCE',
                style: TextStyle(
                  color: AppTheme.primaryGreen,
                  fontSize: 14,
                  fontWeight: FontWeight.bold,
                  letterSpacing: 2,
                ),
              ),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                decoration: BoxDecoration(
                  color: AppTheme.primaryGreen.withOpacity(0.2),
                  borderRadius: BorderRadius.circular(12),
                ),
                child: const Text(
                  'ACTIVE',
                  style: TextStyle(
                    color: AppTheme.primaryGreen,
                    fontSize: 10,
                    fontWeight: FontWeight.bold,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 16),
          Text(
            '${appProvider.currentBalance}',
            style: const TextStyle(
              color: Colors.white,
              fontSize: 48,
              fontWeight: FontWeight.bold,
              fontFamily: 'monospace',
            ),
          ),
          const Text(
            'XC TOKENS',
            style: TextStyle(
              color: AppTheme.darkGreen,
              fontSize: 16,
              fontWeight: FontWeight.bold,
              letterSpacing: 1,
            ),
          ),
          const SizedBox(height: 12),
          Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: Colors.black.withOpacity(0.3),
              borderRadius: BorderRadius.circular(12),
            ),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                const Text(
                  'USD Value',
                  style: TextStyle(
                    color: AppTheme.darkGreen,
                    fontSize: 12,
                  ),
                ),
                Text(
                  '\$${(appProvider.currentBalance * 0.01).toStringAsFixed(2)}',
                  style: const TextStyle(
                    color: Colors.white,
                    fontSize: 14,
                    fontWeight: FontWeight.bold,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildQuickStats(AppProvider appProvider) {
    final connectedPeers = appProvider.connectedPeers.length;
    final transactions = appProvider.getTransactions().length;
    final achievements = appProvider.getAchievements().length;
    
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        border: Border.all(color: AppTheme.darkGreen, width: 1),
        borderRadius: BorderRadius.circular(16),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            'NETWORK STATS',
            style: TextStyle(
              color: AppTheme.primaryGreen,
              fontSize: 12,
              fontWeight: FontWeight.bold,
              letterSpacing: 2,
            ),
          ),
          const SizedBox(height: 16),
          Row(
            children: [
              Expanded(
                child: _buildStatItem(
                  'PEERS',
                  '$connectedPeers',
                  Icons.people,
                  Colors.blue,
                ),
              ),
              Expanded(
                child: _buildStatItem(
                  'TRANSACTIONS',
                  '$transactions',
                  Icons.swap_horiz,
                  Colors.orange,
                ),
              ),
              Expanded(
                child: _buildStatItem(
                  'ACHIEVEMENTS',
                  '$achievements',
                  Icons.emoji_events,
                  Colors.purple,
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildStatItem(String label, String value, IconData icon, Color color) {
    return Column(
      children: [
        Container(
          width: 48,
          height: 48,
          decoration: BoxDecoration(
            color: color.withOpacity(0.2),
            borderRadius: BorderRadius.circular(24),
          ),
          child: Icon(
            icon,
            color: color,
            size: 24,
          ),
        ),
        const SizedBox(height: 8),
        Text(
          value,
          style: const TextStyle(
            color: Colors.white,
            fontSize: 20,
            fontWeight: FontWeight.bold,
          ),
        ),
        const SizedBox(height: 4),
        Text(
          label,
          style: TextStyle(
            color: AppTheme.darkGreen.withOpacity(0.8),
            fontSize: 10,
            fontWeight: FontWeight.bold,
            letterSpacing: 1,
          ),
        ),
      ],
    );
  }

  Widget _buildRecentActivity(AppProvider appProvider) {
    final transactions = appProvider.getTransactions().take(3).toList();
    
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        border: Border.all(color: AppTheme.darkGreen, width: 1),
        borderRadius: BorderRadius.circular(16),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                'RECENT ACTIVITY',
                style: TextStyle(
                  color: AppTheme.primaryGreen,
                  fontSize: 12,
                  fontWeight: FontWeight.bold,
                  letterSpacing: 2,
                ),
              ),
              Text(
                'VIEW ALL',
                style: TextStyle(
                  color: AppTheme.primaryGreen,
                  fontSize: 10,
                  fontWeight: FontWeight.bold,
                ),
              ),
            ],
          ),
          const SizedBox(height: 16),
          
          if (transactions.isEmpty)
            Center(
              child: Column(
                children: [
                  Icon(
                    Icons.history,
                    color: AppTheme.darkGreen.withOpacity(0.5),
                    size: 48,
                  ),
                  const SizedBox(height: 8),
                  Text(
                    'No activity yet',
                    style: TextStyle(
                      color: AppTheme.darkGreen.withOpacity(0.5),
                    ),
                  ),
                ],
              ),
            )
          else
            ...transactions.map((transaction) => Padding(
              padding: const EdgeInsets.only(bottom: 12),
              child: Row(
                children: [
                  Container(
                    width: 40,
                    height: 40,
                    decoration: BoxDecoration(
                      color: transaction.type == 'received' 
                          ? Colors.green.withOpacity(0.2)
                          : Colors.red.withOpacity(0.2),
                      borderRadius: BorderRadius.circular(20),
                    ),
                    child: Icon(
                      transaction.type == 'received' 
                          ? Icons.arrow_downward
                          : Icons.arrow_upward,
                      color: transaction.type == 'received' 
                          ? Colors.green
                          : Colors.red,
                      size: 20,
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          transaction.description,
                          style: const TextStyle(
                            color: Colors.white,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                        Text(
                          _formatTimestamp(transaction.timestamp),
                          style: TextStyle(
                            color: AppTheme.darkGreen.withOpacity(0.6),
                            fontSize: 12,
                          ),
                        ),
                      ],
                    ),
                  ),
                  Text(
                    '${transaction.type == 'received' ? '+' : '-'}${transaction.amount} XC',
                    style: TextStyle(
                      color: transaction.type == 'received' 
                          ? Colors.green
                          : Colors.red,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                ],
              ),
            )),
        ],
      ),
    );
  }

  Widget _buildEconomyInfo() {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        border: Border.all(color: AppTheme.darkGreen, width: 1),
        borderRadius: BorderRadius.circular(16),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            'XC ECONOMY',
            style: TextStyle(
              color: AppTheme.primaryGreen,
              fontSize: 12,
              fontWeight: FontWeight.bold,
              letterSpacing: 2,
            ),
          ),
          const SizedBox(height: 16),
          
          _buildEconomyItem('Peer Connection', '+5 XC', 'Connect to new peers'),
          _buildEconomyItem('Message Sent', '+1 XC', 'Send messages in mesh'),
          _buildEconomyItem('Daily Login', '+50 XC', 'Login daily for rewards'),
          _buildEconomyItem('Achievement', '+25 XC', 'Complete challenges'),
          _buildEconomyItem('Room Creation', '+10 XC', 'Create mesh rooms'),
        ],
      ),
    );
  }

  Widget _buildEconomyItem(String action, String reward, String description) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: Row(
        children: [
          Container(
            width: 32,
            height: 32,
            decoration: BoxDecoration(
              color: AppTheme.primaryGreen.withOpacity(0.2),
              borderRadius: BorderRadius.circular(16),
            ),
            child: const Icon(
              Icons.add,
              color: AppTheme.primaryGreen,
              size: 16,
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  action,
                  style: const TextStyle(
                    color: Colors.white,
                    fontWeight: FontWeight.bold,
                  ),
                ),
                Text(
                  description,
                  style: TextStyle(
                    color: AppTheme.darkGreen.withOpacity(0.6),
                    fontSize: 12,
                  ),
                ),
              ],
            ),
          ),
          Text(
            reward,
            style: const TextStyle(
              color: AppTheme.primaryGreen,
              fontWeight: FontWeight.bold,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildActivityTab(AppProvider appProvider) {
    final transactions = appProvider.getTransactions();
    
    return SingleChildScrollView(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            'TRANSACTION HISTORY',
            style: TextStyle(
              color: AppTheme.primaryGreen,
              fontSize: 16,
              fontWeight: FontWeight.bold,
              letterSpacing: 2,
            ),
          ),
          const SizedBox(height: 16),
          
          if (transactions.isEmpty)
            Center(
              child: Column(
                children: [
                  Icon(
                    Icons.receipt_long,
                    color: AppTheme.darkGreen.withOpacity(0.5),
                    size: 64,
                  ),
                  const SizedBox(height: 16),
                  Text(
                    'No transactions yet',
                    style: TextStyle(
                      color: AppTheme.darkGreen.withOpacity(0.5),
                      fontSize: 16,
                    ),
                  ),
                  const SizedBox(height: 8),
                  Text(
                    'Start using XC to see your activity',
                    style: TextStyle(
                      color: AppTheme.darkGreen.withOpacity(0.3),
                      fontSize: 12,
                    ),
                  ),
                ],
              ),
            )
          else
            ...transactions.map((transaction) => Container(
              margin: const EdgeInsets.only(bottom: 12),
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                border: Border.all(color: AppTheme.darkGreen.withOpacity(0.3), width: 1),
                borderRadius: BorderRadius.circular(12),
              ),
              child: Row(
                children: [
                  Container(
                    width: 48,
                    height: 48,
                    decoration: BoxDecoration(
                      color: transaction.type == 'received' 
                          ? Colors.green.withOpacity(0.2)
                          : Colors.red.withOpacity(0.2),
                      borderRadius: BorderRadius.circular(24),
                    ),
                    child: Icon(
                      transaction.type == 'received' 
                          ? Icons.arrow_downward
                          : Icons.arrow_upward,
                      color: transaction.type == 'received' 
                          ? Colors.green
                          : Colors.red,
                      size: 24,
                    ),
                  ),
                  const SizedBox(width: 16),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          transaction.description,
                          style: const TextStyle(
                            color: Colors.white,
                            fontSize: 16,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                        const SizedBox(height: 4),
                        Text(
                          _formatTimestamp(transaction.timestamp),
                          style: TextStyle(
                            color: AppTheme.darkGreen.withOpacity(0.6),
                            fontSize: 12,
                          ),
                        ),
                      ],
                    ),
                  ),
                  Column(
                    crossAxisAlignment: CrossAxisAlignment.end,
                    children: [
                      Text(
                        '${transaction.type == 'received' ? '+' : '-'}${transaction.amount} XC',
                        style: TextStyle(
                          color: transaction.type == 'received' 
                              ? Colors.green
                              : Colors.red,
                          fontSize: 18,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                      Text(
                        '\$${(transaction.amount * 0.01).toStringAsFixed(2)}',
                        style: TextStyle(
                          color: AppTheme.darkGreen.withOpacity(0.6),
                          fontSize: 12,
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            )),
        ],
      ),
    );
  }

  Widget _buildAchievementsTab(AppProvider appProvider) {
    final achievements = appProvider.getAchievements();
    final achievementList = [
      {'name': 'First Connection', 'description': 'Connect to your first peer', 'icon': Icons.people, 'unlocked': achievements.contains('first_connection')},
      {'name': 'Message Master', 'description': 'Send 100 messages', 'icon': Icons.send, 'unlocked': achievements.contains('message_master')},
      {'name': 'XC Collector', 'description': 'Accumulate 1000 XC', 'icon': Icons.account_balance_wallet, 'unlocked': achievements.contains('xc_collector')},
      {'name': 'Network Builder', 'description': 'Connect to 10 peers', 'icon': Icons.hub, 'unlocked': achievements.contains('network_builder')},
      {'name': 'Room Creator', 'description': 'Create 5 rooms', 'icon': Icons.group_add, 'unlocked': achievements.contains('room_creator')},
      {'name': 'Daily User', 'description': 'Login 7 days in a row', 'icon': Icons.calendar_today, 'unlocked': achievements.contains('daily_user')},
    ];
    
    return SingleChildScrollView(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              const Text(
                'ACHIEVEMENTS',
                style: TextStyle(
                  color: AppTheme.primaryGreen,
                  fontSize: 16,
                  fontWeight: FontWeight.bold,
                  letterSpacing: 2,
                ),
              ),
              Text(
                '${achievements.length}/${achievementList.length}',
                style: const TextStyle(
                  color: AppTheme.primaryGreen,
                  fontSize: 14,
                  fontWeight: FontWeight.bold,
                ),
              ),
            ],
          ),
          const SizedBox(height: 16),
          
          ...achievementList.map((achievement) => Container(
            margin: const EdgeInsets.only(bottom: 12),
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              border: Border.all(
                color: achievement['unlocked'] != null 
                    ? AppTheme.primaryGreen 
                    : AppTheme.darkGreen.withOpacity(0.3), 
                width: achievement['unlocked'] != null ? 2 : 1,
              ),
              borderRadius: BorderRadius.circular(12),
              color: achievement['unlocked'] != null 
                  ? AppTheme.primaryGreen.withOpacity(0.1)
                  : Colors.transparent,
            ),
            child: Row(
              children: [
                Container(
                  width: 48,
                  height: 48,
                  decoration: BoxDecoration(
                    color: achievement['unlocked'] != null
                        ? AppTheme.primaryGreen.withOpacity(0.2)
                        : AppTheme.darkGreen.withOpacity(0.2),
                    borderRadius: BorderRadius.circular(24),
                  ),
                  child: Icon(
                    achievement['icon'] as IconData?,
                    color: achievement['unlocked'] != null
                        ? AppTheme.primaryGreen
                        : AppTheme.darkGreen,
                    size: 24,
                  ),
                ),
                const SizedBox(width: 16),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        achievement['name']?.toString() ?? '',
                        style: TextStyle(
                          color: achievement['unlocked'] != null 
                              ? Colors.white
                              : AppTheme.darkGreen,
                          fontSize: 16,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                      const SizedBox(height: 4),
                      Text(
                        achievement['description']?.toString() ?? '',
                        style: TextStyle(
                          color: achievement['unlocked'] != null
                              ? AppTheme.darkGreen
                              : AppTheme.darkGreen.withOpacity(0.5),
                          fontSize: 12,
                        ),
                      ),
                    ],
                  ),
                ),
                if (achievement['unlocked'] != null)
                  const Icon(
                    Icons.check_circle,
                    color: AppTheme.primaryGreen,
                    size: 24,
                  )
                else
                  Icon(
                    Icons.lock,
                    color: AppTheme.darkGreen.withOpacity(0.5),
                    size: 24,
                  ),
              ],
            ),
          )),
        ],
      ),
    );
  }

  String _formatTimestamp(DateTime timestamp) {
    final now = DateTime.now();
    final difference = now.difference(timestamp);
    
    if (difference.inDays > 0) {
      return '${difference.inDays}d ago';
    } else if (difference.inHours > 0) {
      return '${difference.inHours}h ago';
    } else if (difference.inMinutes > 0) {
      return '${difference.inMinutes}m ago';
    } else {
      return 'Just now';
    }
  }
}
