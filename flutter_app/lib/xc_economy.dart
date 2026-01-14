import 'package:shared_preferences/shared_preferences.dart';
import 'dart:convert';

class XCTransaction {
  final String id;
  final String type; // 'earn' | 'spend' | 'bonus' | 'achievement'
  final int amount;
  final String description;
  final int timestamp;
  final String source;

  XCTransaction({
    required this.id,
    required this.type,
    required this.amount,
    required this.description,
    required this.timestamp,
    required this.source,
  });

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'type': type,
      'amount': amount,
      'description': description,
      'timestamp': timestamp,
      'source': source,
    };
  }

  factory XCTransaction.fromJson(Map<String, dynamic> json) {
    return XCTransaction(
      id: json['id'],
      type: json['type'],
      amount: json['amount'],
      description: json['description'],
      timestamp: json['timestamp'],
      source: json['source'],
    );
  }
}

class XCAchievement {
  final String id;
  final String name;
  final String description;
  final int reward;
  final bool completed;
  final int progress;
  final int maxProgress;
  final String icon;

  XCAchievement({
    required this.id,
    required this.name,
    required this.description,
    required this.reward,
    required this.completed,
    required this.progress,
    required this.maxProgress,
    required this.icon,
  });

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'name': name,
      'description': description,
      'reward': reward,
      'completed': completed,
      'progress': progress,
      'maxProgress': maxProgress,
      'icon': icon,
    };
  }

  factory XCAchievement.fromJson(Map<String, dynamic> json) {
    return XCAchievement(
      id: json['id'],
      name: json['name'],
      description: json['description'],
      reward: json['reward'],
      completed: json['completed'] ?? false,
      progress: json['progress'] ?? 0,
      maxProgress: json['maxProgress'] ?? 1,
      icon: json['icon'] ?? '🏆',
    );
  }
}

class XCStreak {
  final int currentStreak;
  final String lastActiveDate;
  final int totalDays;
  final int nextBonus;

  XCStreak({
    required this.currentStreak,
    required this.lastActiveDate,
    required this.totalDays,
    required this.nextBonus,
  });

  Map<String, dynamic> toJson() {
    return {
      'currentStreak': currentStreak,
      'lastActiveDate': lastActiveDate,
      'totalDays': totalDays,
      'nextBonus': nextBonus,
    };
  }

  factory XCStreak.fromJson(Map<String, dynamic> json) {
    return XCStreak(
      currentStreak: json['currentStreak'] ?? 0,
      lastActiveDate: json['lastActiveDate'] ?? '',
      totalDays: json['totalDays'] ?? 0,
      nextBonus: json['nextBonus'] ?? 10,
    );
  }
}

class XCEconomy {
  static XCEconomy? _instance;
  static XCEconomy get instance => _instance ??= XCEconomy._();

  XCEconomy._();

  int _balance = 1240;
  List<XCTransaction> _transactions = [];
  List<XCAchievement> _achievements = [];
  XCStreak _streak = XCStreak(
    currentStreak: 0,
    lastActiveDate: '',
    totalDays: 0,
    nextBonus: 10,
  );

  int get balance => _balance;
  List<XCTransaction> get transactions => List.unmodifiable(_transactions);
  List<XCAchievement> get achievements => List.unmodifiable(_achievements);
  XCStreak get streak => _streak;

  Future<void> _loadState() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final saved = prefs.getString('xc_economy');
      if (saved != null) {
        final data = json.decode(saved);
        _balance = data['balance'] ?? 1240;
        _transactions = (data['transactions'] as List?)
                ?.map((t) => XCTransaction.fromJson(t))
                .toList() ??
            [];
        _streak = XCStreak.fromJson(data['streak'] ?? {});
      }
    } catch (error) {
      print('Failed to load XC economy state: $error');
    }
  }

  Future<void> _saveState() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      await prefs.setString('xc_economy', json.encode({
        'balance': _balance,
        'transactions': _transactions.map((t) => t.toJson()).toList(),
        'streak': _streak.toJson(),
      }));
    } catch (error) {
      print('Failed to save XC economy state: $error');
    }
  }

  void _initializeAchievements() {
    _achievements = [
      XCAchievement(
        id: 'first_post',
        name: 'First Steps',
        description: 'Post your first buzz message',
        reward: 25,
        completed: false,
        progress: 0,
        maxProgress: 1,
        icon: '📝',
      ),
      XCAchievement(
        id: 'first_chat',
        name: 'Social Butterfly',
        description: 'Send your first chat message',
        reward: 10,
        completed: false,
        progress: 0,
        maxProgress: 1,
        icon: '💬',
      ),
      XCAchievement(
        id: 'daily_login',
        name: 'Regular',
        description: 'Log in 7 days in a row',
        reward: 100,
        completed: false,
        progress: 0,
        maxProgress: 7,
        icon: '📅',
      ),
      XCAchievement(
        id: 'mesh_master',
        name: 'Mesh Master',
        description: 'Connect to 10 different nodes',
        reward: 500,
        completed: false,
        progress: 0,
        maxProgress: 10,
        icon: '🔗',
      ),
    ];
  }

  Future<void> initialize() async {
    await _loadState();
    if (_achievements.isEmpty) {
      _initializeAchievements();
    }
    _checkDailyStreak();
  }

  void addXC(int amount, String description, String source) {
    _balance += amount;
    _transactions.add(XCTransaction(
      id: 'tx_${DateTime.now().millisecondsSinceEpoch}',
      type: amount > 0 ? 'earn' : 'spend',
      amount: amount,
      description: description,
      timestamp: DateTime.now().millisecondsSinceEpoch,
      source: source,
    ));
    _saveState();
  }

  bool spendXC(int amount, String description, String source) {
    if (_balance >= amount) {
      _balance -= amount;
      _transactions.add(XCTransaction(
        id: 'tx_${DateTime.now().millisecondsSinceEpoch}',
        type: 'spend',
        amount: -amount,
        description: description,
        timestamp: DateTime.now().millisecondsSinceEpoch,
        source: source,
      ));
      _saveState();
      return true;
    }
    return false;
  }

  void awardDailyLogin() {
    final today = DateTime.now();
    final todayStr = '${today.year}-${today.month}-${today.day}';
    
    if (_streak.lastActiveDate != todayStr) {
      if (_streak.lastActiveDate == _getYesterday(today)) {
        _streak = XCStreak(
          currentStreak: _streak.currentStreak + 1,
          lastActiveDate: todayStr,
          totalDays: _streak.totalDays + 1,
          nextBonus: _streak.nextBonus + 5,
        );
      } else {
        _streak = XCStreak(
          currentStreak: 1,
          lastActiveDate: todayStr,
          totalDays: _streak.totalDays + 1,
          nextBonus: 10,
        );
      }
      
      // Award streak bonus
      final bonus = _streak.currentStreak * 5;
      addXC(bonus, 'Daily login bonus (streak: ${_streak.currentStreak})', 'daily_bonus');
      _saveState();
    }
  }

  void _checkDailyStreak() {
    final today = DateTime.now();
    final todayStr = '${today.year}-${today.month}-${today.day}';
    
    if (_streak.lastActiveDate != todayStr) {
      if (_streak.lastActiveDate != _getYesterday(today)) {
        // Streak broken
        _streak = XCStreak(
          currentStreak: 0,
          lastActiveDate: _streak.lastActiveDate,
          totalDays: _streak.totalDays,
          nextBonus: 10,
        );
      }
    }
  }

  String _getYesterday(DateTime today) {
    final yesterday = today.subtract(const Duration(days: 1));
    return '${yesterday.year}-${yesterday.month}-${yesterday.day}';
  }

  void updateAchievement(String achievementId, int progress) {
    final achievement = _achievements.firstWhere(
      (a) => a.id == achievementId,
      orElse: () => XCAchievement(
        id: achievementId,
        name: 'Unknown',
        description: 'Unknown achievement',
        reward: 0,
        completed: false,
        progress: 0,
        maxProgress: 1,
        icon: '🏆',
      ),
    );

    if (!achievement.completed) {
      final updatedAchievement = XCAchievement(
        id: achievement.id,
        name: achievement.name,
        description: achievement.description,
        reward: achievement.reward,
        completed: progress >= achievement.maxProgress,
        progress: progress,
        maxProgress: achievement.maxProgress,
        icon: achievement.icon,
      );

      final index = _achievements.indexWhere((a) => a.id == achievementId);
      _achievements[index] = updatedAchievement;

      if (updatedAchievement.completed && !achievement.completed) {
        addXC(achievement.reward, 'Achievement unlocked: ${achievement.name}', 'achievement');
      }
      
      _saveState();
    }
  }

  void completeAchievement(String achievementId) {
    final achievement = _achievements.firstWhere(
      (a) => a.id == achievementId,
      orElse: () => XCAchievement(
        id: achievementId,
        name: 'Unknown',
        description: 'Unknown achievement',
        reward: 0,
        completed: false,
        progress: 0,
        maxProgress: 1,
        icon: '🏆',
      ),
    );

    if (!achievement.completed) {
      updateAchievement(achievementId, achievement.maxProgress);
    }
  }
}

// Global instance for easy access
final xcEconomy = XCEconomy.instance;
