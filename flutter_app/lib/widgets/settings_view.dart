import 'package:flutter/material.dart';
import '../services/xc_economy.dart';

class SettingsView extends StatelessWidget {
  final bool isRealMode;
  final bool isDiscovering;
  final Function() onToggleMode;
  final Function() onStartDiscovery;
  final Function() onStopDiscovery;
  final int connectedPeersCount;
  final List<XCTransaction> transactions;
  final Set<String> achievements;

  const SettingsView({
    super.key,
    required this.isRealMode,
    required this.isDiscovering,
    required this.onToggleMode,
    required this.onStartDiscovery,
    required this.onStopDiscovery,
    required this.connectedPeersCount,
    required this.transactions,
    required this.achievements,
  });

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.black,
      appBar: AppBar(
        title: const Text(
          'Settings',
          style: TextStyle(color: Colors.green),
        ),
        backgroundColor: Colors.black,
        elevation: 0,
      ),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          Card(
            color: Colors.black.withOpacity(0.8),
            child: ListTile(
              title: const Text(
                'Discovery Mode',
                style: TextStyle(color: Colors.white),
              ),
              subtitle: Text(
                isRealMode ? 'Real P2P Mode' : 'Simulated Mode',
                style: TextStyle(color: Colors.white.withOpacity(0.7)),
              ),
              trailing: Switch(
                value: isRealMode,
                onChanged: (value) => onToggleMode(),
                activeThumbColor: Colors.green,
              ),
            ),
          ),
          Card(
            color: Colors.black.withOpacity(0.8),
            child: ListTile(
              title: const Text(
                'Discovery Status',
                style: TextStyle(color: Colors.white),
              ),
              subtitle: Text(
                isDiscovering ? 'Discovering peers...' : 'Discovery stopped',
                style: TextStyle(color: Colors.white.withOpacity(0.7)),
              ),
              trailing: Icon(
                isDiscovering ? Icons.search : Icons.stop,
                color: isDiscovering ? Colors.green : Colors.red,
              ),
              onTap: isDiscovering ? onStopDiscovery : onStartDiscovery,
            ),
          ),
          Card(
            color: Colors.black.withOpacity(0.8),
            child: ListTile(
              title: const Text(
                'Connected Peers',
                style: TextStyle(color: Colors.white),
              ),
              subtitle: Text(
                '$connectedPeersCount peers connected',
                style: TextStyle(color: Colors.white.withOpacity(0.7)),
              ),
              trailing: const Icon(
                Icons.people,
                color: Colors.green,
              ),
            ),
          ),
          const SizedBox(height: 20),
          Card(
            color: Colors.black.withOpacity(0.8),
            child: ListTile(
              title: const Text(
                'Achievements',
                style: TextStyle(color: Colors.white),
              ),
              subtitle: Text(
                '${achievements.length} unlocked',
                style: TextStyle(color: Colors.white.withOpacity(0.7)),
              ),
              trailing: const Icon(
                Icons.emoji_events,
                color: Colors.green,
              ),
            ),
          ),
          Card(
            color: Colors.black.withOpacity(0.8),
            child: ListTile(
              title: const Text(
                'Recent Transactions',
                style: TextStyle(color: Colors.white),
              ),
              subtitle: Text(
                '${transactions.length} transactions',
                style: TextStyle(color: Colors.white.withOpacity(0.7)),
              ),
              trailing: const Icon(
                Icons.history,
                color: Colors.green,
              ),
              onTap: () => _showTransactions(context),
            ),
          ),
        ],
      ),
    );
  }

  void _showTransactions(BuildContext context) {
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        backgroundColor: Colors.black,
        title: const Text(
          'Recent Transactions',
          style: TextStyle(color: Colors.green),
        ),
        content: SizedBox(
          width: double.maxFinite,
          height: 300,
          child: transactions.isEmpty
              ? const Center(
                  child: Text(
                    'No transactions yet',
                    style: TextStyle(color: Colors.white),
                  ),
                )
              : ListView.builder(
                  itemCount: transactions.length,
                  itemBuilder: (context, index) {
                    final transaction = transactions[index];
                    return ListTile(
                      title: Text(
                        transaction.description,
                        style: const TextStyle(color: Colors.white),
                      ),
                      subtitle: Text(
                        transaction.timestamp.toString().substring(0, 19),
                        style: TextStyle(color: Colors.white.withOpacity(0.7)),
                      ),
                      trailing: Text(
                        '${transaction.type == TransactionType.credit ? '+' : '-'}${transaction.amount} XC',
                        style: TextStyle(
                          color: transaction.type == TransactionType.credit 
                              ? Colors.green 
                              : Colors.red,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                    );
                  },
                ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(context).pop(),
            child: const Text('Close'),
          ),
        ],
      ),
    );
  }
}
