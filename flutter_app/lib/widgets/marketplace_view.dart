import 'package:flutter/material.dart';

class MarketplaceView extends StatelessWidget {
  final int balance;
  final Map<String, int> inventory;
  final Function(String, int) onPurchaseItem;
  final Function(String, int) onSellItem;

  const MarketplaceView({
    super.key,
    required this.balance,
    required this.inventory,
    required this.onPurchaseItem,
    required this.onSellItem,
  });

  static const Map<String, int> itemPrices = {
    'node_upgrade': 500,
    'encryption_key': 100,
    'mesh_booster': 250,
    'storage_expansion': 150,
    'premium_theme': 75,
    'voice_changer': 50,
    'anonymity_boost': 300,
    'speed_boost': 200,
  };

  static const Map<String, String> itemNames = {
    'node_upgrade': 'Node Upgrade',
    'encryption_key': 'Encryption Key',
    'mesh_booster': 'Mesh Booster',
    'storage_expansion': 'Storage Expansion',
    'premium_theme': 'Premium Theme',
    'voice_changer': 'Voice Changer',
    'anonymity_boost': 'Anonymity Boost',
    'speed_boost': 'Speed Boost',
  };

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.black,
      appBar: AppBar(
        title: const Text(
          'Marketplace',
          style: TextStyle(color: Colors.green),
        ),
        backgroundColor: Colors.black,
        elevation: 0,
      ),
      body: Column(
        children: [
          Container(
            padding: const EdgeInsets.all(16),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text(
                  'Balance: $balance XC',
                  style: const TextStyle(
                    color: Colors.green,
                    fontSize: 18,
                    fontWeight: FontWeight.bold,
                  ),
                ),
                ElevatedButton.icon(
                  onPressed: () => _showInventory(context),
                  icon: const Icon(Icons.inventory, color: Colors.white),
                  label: const Text('Inventory', style: TextStyle(color: Colors.white)),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: Colors.green.shade600,
                  ),
                ),
              ],
            ),
          ),
          Expanded(
            child: ListView.builder(
              itemCount: itemPrices.length,
              itemBuilder: (context, index) {
                final itemId = itemPrices.keys.elementAt(index);
                final price = itemPrices[itemId]!;
                final name = itemNames[itemId]!;
                final owned = inventory[itemId] ?? 0;

                return Card(
                  color: Colors.black.withOpacity(0.8),
                  margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                  child: ListTile(
                    leading: CircleAvatar(
                      backgroundColor: Colors.green.shade600,
                      child: Icon(
                        _getItemIcon(itemId),
                        color: Colors.white,
                        size: 20,
                      ),
                    ),
                    title: Text(
                      name,
                      style: const TextStyle(
                        color: Colors.white,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                    subtitle: Text(
                      'Owned: $owned',
                      style: TextStyle(color: Colors.white.withOpacity(0.7)),
                    ),
                    trailing: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Text(
                          '$price XC',
                          style: TextStyle(
                            color: balance >= price ? Colors.green : Colors.red,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                        const SizedBox(width: 8),
                        if (owned > 0)
                          IconButton(
                            icon: const Icon(Icons.sell, color: Colors.orange),
                            onPressed: () => onSellItem(itemId, price ~/ 2),
                            tooltip: 'Sell for ${price ~/ 2} XC',
                          )
                        else
                          IconButton(
                            icon: const Icon(Icons.add_shopping_cart, color: Colors.green),
                            onPressed: balance >= price 
                                ? () => onPurchaseItem(itemId, price)
                                : null,
                            tooltip: 'Buy for $price XC',
                          ),
                      ],
                    ),
                  ),
                );
              },
            ),
          ),
        ],
      ),
    );
  }

  IconData _getItemIcon(String itemId) {
    switch (itemId) {
      case 'node_upgrade':
        return Icons.upgrade;
      case 'encryption_key':
        return Icons.vpn_key;
      case 'mesh_booster':
        return Icons.network_cell;
      case 'storage_expansion':
        return Icons.storage;
      case 'premium_theme':
        return Icons.palette;
      case 'voice_changer':
        return Icons.record_voice_over;
      case 'anonymity_boost':
        return Icons.security;
      case 'speed_boost':
        return Icons.speed;
      default:
        return Icons.category;
    }
  }

  void _showInventory(BuildContext context) {
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        backgroundColor: Colors.black,
        title: const Text(
          'Your Inventory',
          style: TextStyle(color: Colors.green),
        ),
        content: SizedBox(
          width: double.maxFinite,
          height: 300,
          child: inventory.isEmpty
              ? const Center(
                  child: Text(
                    'No items in inventory',
                    style: TextStyle(color: Colors.white),
                  ),
                )
              : ListView.builder(
                  itemCount: inventory.length,
                  itemBuilder: (context, index) {
                    final itemId = inventory.keys.elementAt(index);
                    final quantity = inventory[itemId]!;
                    final name = itemNames[itemId] ?? itemId;
                    
                    return ListTile(
                      leading: CircleAvatar(
                        backgroundColor: Colors.green.shade600,
                        child: Icon(
                          _getItemIcon(itemId),
                          color: Colors.white,
                          size: 20,
                        ),
                      ),
                      title: Text(
                        name,
                        style: const TextStyle(color: Colors.white),
                      ),
                      trailing: Text(
                        'x$quantity',
                        style: const TextStyle(
                          color: Colors.green,
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
