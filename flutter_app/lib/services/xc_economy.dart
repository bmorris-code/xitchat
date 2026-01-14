import 'dart:async';
import 'dart:convert';
import 'dart:math';
import 'package:shared_preferences/shared_preferences.dart';

class XCEconomy {
  static final XCEconomy _instance = XCEconomy._internal();
  factory XCEconomy() => _instance;
  XCEconomy._internal();

  static const String _balanceKey = 'xc_balance';
  static const String _transactionsKey = 'xc_transactions';
  static const String _dailyLoginKey = 'xc_daily_login';
  static const String _inventoryKey = 'xc_inventory';
  static const String _achievementsKey = 'xc_achievements';

  int _balance = 0;
  final List<XCTransaction> _transactions = [];
  final Map<String, int> _inventory = {};
  final Set<String> _achievements = {};
  DateTime? _lastDailyLogin;

  final StreamController<int> _balanceController = StreamController.broadcast();
  final StreamController<XCTransaction> _transactionController = StreamController.broadcast();

  Stream<int> get balanceStream => _balanceController.stream;
  Stream<XCTransaction> get transactionStream => _transactionController.stream;

  int get balance => _balance;
  List<XCTransaction> get transactions => List.unmodifiable(_transactions);
  Map<String, int> get inventory => Map.unmodifiable(_inventory);
  Set<String> get achievements => Set.unmodifiable(_achievements);

  String _generateId() {
    return '${DateTime.now().millisecondsSinceEpoch}_${Random().nextInt(10000)}';
  }

  Future<void> initialize() async {
    await _loadData();
    await _checkDailyLogin();
  }

  Future<void> _loadData() async {
    final prefs = await SharedPreferences.getInstance();
    
    _balance = prefs.getInt(_balanceKey) ?? 1000; // Starting balance
    
    final transactionsJson = prefs.getStringList(_transactionsKey) ?? [];
    _transactions.clear();
    for (final json in transactionsJson) {
      _transactions.add(XCTransaction.fromJson(jsonDecode(json)));
    }

    final inventoryJson = prefs.getString(_inventoryKey) ?? '{}';
    final inventoryMap = jsonDecode(inventoryJson) as Map<String, dynamic>;
    _inventory.clear();
    inventoryMap.forEach((key, value) => _inventory[key] = value);

    final achievementsJson = prefs.getStringList(_achievementsKey) ?? [];
    _achievements.clear();
    _achievements.addAll(achievementsJson);

    final lastLoginTimestamp = prefs.getInt(_dailyLoginKey);
    if (lastLoginTimestamp != null) {
      _lastDailyLogin = DateTime.fromMillisecondsSinceEpoch(lastLoginTimestamp);
    }

    _balanceController.add(_balance);
  }

  Future<void> _saveData() async {
    final prefs = await SharedPreferences.getInstance();
    
    await prefs.setInt(_balanceKey, _balance);
    
    final transactionsJson = _transactions.map((t) => jsonEncode(t.toJson())).toList();
    await prefs.setStringList(_transactionsKey, transactionsJson);
    
    await prefs.setString(_inventoryKey, jsonEncode(_inventory));
    
    await prefs.setStringList(_achievementsKey, _achievements.toList());
    
    if (_lastDailyLogin != null) {
      await prefs.setInt(_dailyLoginKey, _lastDailyLogin!.millisecondsSinceEpoch);
    }
  }

  Future<void> _checkDailyLogin() async {
    final now = DateTime.now();
    
    if (_lastDailyLogin == null || 
        !_isSameDay(_lastDailyLogin!, now)) {
      await awardDailyLogin();
    }
  }

  bool _isSameDay(DateTime date1, DateTime date2) {
    return date1.year == date2.year &&
           date1.month == date2.month &&
           date1.day == date2.day;
  }

  Future<void> awardDailyLogin() async {
    const dailyReward = 50;
    await addBalance(dailyReward, 'Daily login reward');
    
    _lastDailyLogin = DateTime.now();
    await _saveData();
    
    await unlockAchievement('daily_login');
  }

  Future<void> addBalance(int amount, String description) async {
    if (amount <= 0) return;

    _balance += amount;
    
    final transaction = XCTransaction(
      id: _generateId(),
      amount: amount,
      description: description,
      type: TransactionType.credit,
      timestamp: DateTime.now(),
    );
    
    _transactions.insert(0, transaction);
    
    await _saveData();
    _balanceController.add(_balance);
    _transactionController.add(transaction);
  }

  Future<bool> spendBalance(int amount, String description) async {
    if (amount <= 0 || _balance < amount) return false;

    _balance -= amount;
    
    final transaction = XCTransaction(
      id: _generateId(),
      amount: amount,
      description: description,
      type: TransactionType.debit,
      timestamp: DateTime.now(),
    );
    
    _transactions.insert(0, transaction);
    
    await _saveData();
    _balanceController.add(_balance);
    _transactionController.add(transaction);
    
    return true;
  }

  Future<bool> purchaseItem(String itemId, int cost, {int quantity = 1}) async {
    final totalCost = cost * quantity;
    
    if (_balance < totalCost) return false;
    
    final success = await spendBalance(totalCost, 'Purchased $quantity x $itemId');
    
    if (success) {
      _inventory[itemId] = (_inventory[itemId] ?? 0) + quantity;
      await _saveData();
      
      await unlockAchievement('first_purchase');
    }
    
    return success;
  }

  Future<bool> sellItem(String itemId, int price, {int quantity = 1}) async {
    final currentQuantity = _inventory[itemId] ?? 0;
    
    if (currentQuantity < quantity) return false;
    
    _inventory[itemId] = currentQuantity - quantity;
    if (_inventory[itemId] == 0) {
      _inventory.remove(itemId);
    }
    
    await addBalance(price * quantity, 'Sold $quantity x $itemId');
    await _saveData();
    
    return true;
  }

  Future<void> unlockAchievement(String achievementId) async {
    if (_achievements.contains(achievementId)) return;
    
    _achievements.add(achievementId);
    
    // Award bonus XC for achievements
    final achievementRewards = {
      'daily_login': 10,
      'first_purchase': 25,
      'mesh_master': 100,
      'trader': 50,
      'collector': 75,
    };
    
    final reward = achievementRewards[achievementId] ?? 0;
    if (reward > 0) {
      await addBalance(reward, 'Achievement unlocked: $achievementId');
    }
    
    await _saveData();
  }

  Future<void> awardMeshActivity(int connectedPeers, int messagesExchanged) async {
    // Award XC for mesh network participation
    final peerBonus = connectedPeers * 2;
    final messageBonus = (messagesExchanged / 10).floor() * 1;
    
    if (peerBonus > 0) {
      await addBalance(peerBonus, 'Mesh network participation: $connectedPeers peers');
    }
    
    if (messageBonus > 0) {
      await addBalance(messageBonus, 'Mesh messaging: $messagesExchanged messages');
    }
    
    if (connectedPeers >= 5) {
      await unlockAchievement('mesh_master');
    }
  }

  Future<void> awardTradingActivity(int tradesCompleted) async {
    if (tradesCompleted >= 1) {
      await unlockAchievement('trader');
    }
    
    // Bonus XC for trading milestones
    if (tradesCompleted == 1) {
      await addBalance(10, 'First trade completed');
    } else if (tradesCompleted == 10) {
      await addBalance(50, '10 trades milestone');
    } else if (tradesCompleted == 50) {
      await addBalance(200, '50 trades milestone');
    }
  }

  int getItemQuantity(String itemId) {
    return _inventory[itemId] ?? 0;
  }

  List<String> getAvailableItems() {
    return [
      'node_upgrade',
      'encryption_key',
      'mesh_booster',
      'storage_expansion',
      'premium_theme',
      'voice_changer',
      'anonymity_boost',
      'speed_boost',
    ];
  }

  Map<String, int> getItemPrices() {
    return {
      'node_upgrade': 500,
      'encryption_key': 100,
      'mesh_booster': 250,
      'storage_expansion': 150,
      'premium_theme': 75,
      'voice_changer': 50,
      'anonymity_boost': 300,
      'speed_boost': 200,
    };
  }

  Future<void> resetBalance() async {
    _balance = 1000;
    _transactions.clear();
    _inventory.clear();
    _achievements.clear();
    _lastDailyLogin = null;
    
    await _saveData();
    _balanceController.add(_balance);
  }

  void dispose() {
    _balanceController.close();
    _transactionController.close();
  }
}

enum TransactionType {
  credit,
  debit,
}

class XCTransaction {
  final String id;
  final int amount;
  final String description;
  final TransactionType type;
  final DateTime timestamp;

  XCTransaction({
    required this.id,
    required this.amount,
    required this.description,
    required this.type,
    required this.timestamp,
  });

  factory XCTransaction.fromJson(Map<String, dynamic> json) {
    return XCTransaction(
      id: json['id'] ?? '',
      amount: json['amount'] ?? 0,
      description: json['description'] ?? '',
      type: TransactionType.values.firstWhere(
        (e) => e.toString() == 'TransactionType.${json['type']}',
        orElse: () => TransactionType.credit,
      ),
      timestamp: DateTime.parse(json['timestamp'] ?? DateTime.now().toIso8601String()),
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'amount': amount,
      'description': description,
      'type': type.toString().split('.').last,
      'timestamp': timestamp.toIso8601String(),
    };
  }
}
