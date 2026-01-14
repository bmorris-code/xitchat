import 'dart:async';
import 'dart:convert';
import 'dart:math';
import 'dart:typed_data';
import 'package:flutter/foundation.dart';
import 'package:crypto/crypto.dart';
import 'package:shared_preferences/shared_preferences.dart';

class PoWService {
  static final PoWService _instance = PoWService._internal();
  factory PoWService() => _instance;
  PoWService._internal();

  // PoW configuration
  int _difficulty = 4; // Number of leading zeros required
  int _maxNonce = 1000000;
  String _algorithm = 'SHA-256';
  bool _isMining = false;
  Timer? _miningTimer;
  
  // Mining metrics
  Map<String, dynamic> _miningMetrics = {
    'hashesComputed': 0,
    'totalHashRate': 0.0,
    'averageHashRate': 0.0,
    'blocksMined': 0,
    'totalMiningTime': 0,
    'lastBlockTime': null,
    'currentDifficulty': 4,
    'efficiency': 0.0,
  };

  // Current mining state
  String? _currentChallenge;
  int _currentNonce = 0;
  DateTime? _miningStartTime;
  String? _lastValidHash;
  
  // Stream controllers
  final StreamController<Map<String, dynamic>> _statusController = 
      StreamController.broadcast();
  final StreamController<Map<String, dynamic>> _blockController = 
      StreamController.broadcast();
  final StreamController<String> _logController = 
      StreamController.broadcast();

  Stream<Map<String, dynamic>> get statusStream => _statusController.stream;
  Stream<Map<String, dynamic>> get blockStream => _blockController.stream;
  Stream<String> get logStream => _logController.stream;

  bool get isMining => _isMining;
  int get difficulty => _difficulty;
  Map<String, dynamic> get miningMetrics => Map.unmodifiable(_miningMetrics);
  String? get currentChallenge => _currentChallenge;
  String? get lastValidHash => _lastValidHash;

  Future<bool> initialize() async {
    try {
      debugPrint('⛏️ Initializing PoW Service...');
      
      // Load saved metrics
      await _loadMiningMetrics();
      
      // Generate initial challenge
      _generateNewChallenge();
      
      debugPrint('✅ PoW Service initialized');
      _emitLog('PoW Service initialized with difficulty $_difficulty');
      return true;
    } catch (error) {
      debugPrint('❌ PoW initialization failed: $error');
      _emitLog('PoW initialization failed: $error');
      return false;
    }
  }

  Future<void> _loadMiningMetrics() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final metricsJson = prefs.getString('pow_metrics');
      
      if (metricsJson != null) {
        _miningMetrics = Map<String, dynamic>.from(jsonDecode(metricsJson));
        _difficulty = _miningMetrics['currentDifficulty'] ?? 4;
        debugPrint('📊 Loaded mining metrics: ${_miningMetrics['blocksMined']} blocks mined');
      }
    } catch (error) {
      debugPrint('Failed to load mining metrics: $error');
    }
  }

  Future<void> _saveMiningMetrics() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      await prefs.setString('pow_metrics', jsonEncode(_miningMetrics));
    } catch (error) {
      debugPrint('Failed to save mining metrics: $error');
    }
  }

  void _generateNewChallenge() {
    final timestamp = DateTime.now().millisecondsSinceEpoch.toString();
    final random = Random().nextInt(1000000).toString();
    final previousHash = _lastValidHash ?? '0' * 64;
    
    _currentChallenge = '$timestamp-$random-$previousHash';
    _currentNonce = 0;
    
    _emitLog('New challenge generated: ${_currentChallenge!.substring(0, 16)}...');
    _emitStatus('challenge_updated', {'challenge': _currentChallenge});
  }

  Future<bool> startMining() async {
    try {
      if (_isMining) {
        debugPrint('⚠️ Mining already in progress');
        return false;
      }
      
      debugPrint('⛏️ Starting PoW mining...');
      _isMining = true;
      _miningStartTime = DateTime.now();
      
      _emitLog('Mining started with difficulty $_difficulty');
      _emitStatus('mining_started', {
        'difficulty': _difficulty,
        'challenge': _currentChallenge,
        'startTime': _miningStartTime?.toIso8601String(),
      });
      
      // Start mining in background
      _startMiningProcess();
      
      return true;
    } catch (error) {
      debugPrint('❌ Failed to start mining: $error');
      _isMining = false;
      return false;
    }
  }

  void _startMiningProcess() {
    _miningTimer = Timer.periodic(const Duration(milliseconds: 100), (timer) {
      if (!_isMining) {
        timer.cancel();
        return;
      }
      
      _mineBlock();
    });
  }

  Future<void> _mineBlock() async {
    try {
      final startTime = DateTime.now().millisecondsSinceEpoch;
      
      // Mine multiple hashes per cycle for efficiency
      const hashesPerCycle = 100;
      
      for (int i = 0; i < hashesPerCycle && _isMining; i++) {
        _currentNonce++;
        
        // Calculate hash
        final hash = _calculateHash(_currentChallenge!, _currentNonce);
        
        // Check if hash meets difficulty
        if (_isValidHash(hash)) {
          await _onBlockFound(hash, _currentNonce);
          return;
        }
        
        // Update metrics
        _miningMetrics['hashesComputed'] = (_miningMetrics['hashesComputed'] as int) + 1;
      }
      
      // Calculate hash rate
      final endTime = DateTime.now().millisecondsSinceEpoch;
      final timeTaken = (endTime - startTime) / 1000.0;
      final currentHashRate = hashesPerCycle / timeTaken;
      
      _miningMetrics['totalHashRate'] = currentHashRate;
      _updateAverageHashRate();
      
      // Emit progress update
      if (_currentNonce % 10000 == 0) {
        _emitStatus('mining_progress', {
          'nonce': _currentNonce,
          'hashRate': currentHashRate,
          'hashesComputed': _miningMetrics['hashesComputed'],
        });
      }
      
      // Check if we should stop (max nonce reached)
      if (_currentNonce >= _maxNonce) {
        await stopMining();
        _emitLog('Mining stopped: max nonce reached');
      }
      
    } catch (error) {
      debugPrint('❌ Mining error: $error');
      _emitLog('Mining error: $error');
    }
  }

  String _calculateHash(String challenge, int nonce) {
    final data = '$challenge-$nonce';
    final bytes = utf8.encode(data);
    final digest = sha256.convert(bytes);
    return digest.toString();
  }

  bool _isValidHash(String hash) {
    // Check if hash starts with required number of zeros
    final targetPrefix = '0' * _difficulty;
    return hash.startsWith(targetPrefix);
  }

  Future<void> _onBlockFound(String hash, int nonce) async {
    try {
      final endTime = DateTime.now();
      final miningTime = endTime.difference(_miningStartTime!).inMilliseconds;
      
      // Update metrics
      _miningMetrics['blocksMined'] = (_miningMetrics['blocksMined'] as int) + 1;
      _miningMetrics['totalMiningTime'] = (_miningMetrics['totalMiningTime'] as int) + miningTime;
      _miningMetrics['lastBlockTime'] = endTime.toIso8601String();
      _miningMetrics['efficiency'] = _calculateEfficiency();
      
      _lastValidHash = hash;
      
      // Create block data
      final blockData = {
        'hash': hash,
        'nonce': nonce,
        'challenge': _currentChallenge,
        'difficulty': _difficulty,
        'timestamp': endTime.toIso8601String(),
        'miningTime': miningTime,
        'hashesComputed': _miningMetrics['hashesComputed'],
        'hashRate': _miningMetrics['totalHashRate'],
      };
      
      debugPrint('🎉 Block found! Hash: $hash');
      debugPrint('⛏️ Mining completed in ${miningTime}ms with nonce $nonce');
      
      _emitLog('Block found: $hash (nonce: $nonce, time: ${miningTime}ms)');
      _emitStatus('block_found', blockData);
      _blockController.add(blockData);
      
      // Save metrics
      await _saveMiningMetrics();
      
      // Stop current mining
      await stopMining();
      
      // Generate new challenge for next block
      _generateNewChallenge();
      
      // Auto-adjust difficulty based on mining time
      _adjustDifficulty(miningTime);
      
    } catch (error) {
      debugPrint('❌ Error handling block found: $error');
    }
  }

  double _calculateEfficiency() {
    final blocksMined = _miningMetrics['blocksMined'] as int;
    final totalTime = _miningMetrics['totalMiningTime'] as int;
    
    if (blocksMined == 0 || totalTime == 0) return 0.0;
    
    // Efficiency = blocks per second
    return (blocksMined * 1000) / totalTime;
  }

  void _updateAverageHashRate() {
    final currentRate = _miningMetrics['totalHashRate'] as double;
    final blocksMined = _miningMetrics['blocksMined'] as int;
    
    if (blocksMined == 0) {
      _miningMetrics['averageHashRate'] = currentRate;
    } else {
      // Calculate running average
      final currentAvg = _miningMetrics['averageHashRate'] as double;
      _miningMetrics['averageHashRate'] = (currentAvg * (blocksMined - 1) + currentRate) / blocksMined;
    }
  }

  void _adjustDifficulty(int miningTime) {
    // Target mining time: 30 seconds
    const targetTime = 30000; // milliseconds
    
    if (miningTime < targetTime * 0.8) {
      // Mining too fast, increase difficulty
      _difficulty = min(_difficulty + 1, 8);
      debugPrint('📈 Difficulty increased to $_difficulty');
      _emitLog('Difficulty increased to $_difficulty (mining too fast)');
    } else if (miningTime > targetTime * 1.2) {
      // Mining too slow, decrease difficulty
      _difficulty = max(_difficulty - 1, 1);
      debugPrint('📉 Difficulty decreased to $_difficulty');
      _emitLog('Difficulty decreased to $_difficulty (mining too slow)');
    }
    
    _miningMetrics['currentDifficulty'] = _difficulty;
  }

  Future<bool> stopMining() async {
    try {
      if (!_isMining) {
        return false;
      }
      
      debugPrint('🛑 Stopping PoW mining...');
      _isMining = false;
      
      // Cancel mining timer
      _miningTimer?.cancel();
      _miningTimer = null;
      
      // Calculate final metrics
      if (_miningStartTime != null) {
        final totalTime = DateTime.now().difference(_miningStartTime!).inMilliseconds;
        _miningMetrics['totalMiningTime'] = (_miningMetrics['totalMiningTime'] as int) + totalTime;
      }
      
      _emitLog('Mining stopped');
      _emitStatus('mining_stopped', {
        'finalNonce': _currentNonce,
        'totalHashes': _miningMetrics['hashesComputed'],
        'miningTime': _miningMetrics['totalMiningTime'],
      });
      
      // Save metrics
      await _saveMiningMetrics();
      
      return true;
    } catch (error) {
      debugPrint('❌ Failed to stop mining: $error');
      return false;
    }
  }

  Future<bool> validateProof(String challenge, int nonce, String hash) async {
    try {
      // Recalculate hash
      final calculatedHash = _calculateHash(challenge, nonce);
      
      // Check if hash matches
      final isValid = calculatedHash == hash && _isValidHash(hash);
      
      debugPrint('🔍 Proof validation: $isValid');
      _emitLog('Proof validation: $isValid for challenge ${challenge.substring(0, 16)}...');
      
      return isValid;
    } catch (error) {
      debugPrint('❌ Proof validation failed: $error');
      return false;
    }
  }

  Future<Map<String, dynamic>> getMiningStats() async {
    return {
      'isMining': _isMining,
      'currentNonce': _currentNonce,
      'currentChallenge': _currentChallenge,
      'difficulty': _difficulty,
      'lastValidHash': _lastValidHash,
      'metrics': _miningMetrics,
      'algorithm': _algorithm,
      'maxNonce': _maxNonce,
    };
  }

  Future<void> setDifficulty(int newDifficulty) async {
    if (newDifficulty < 1 || newDifficulty > 8) {
      throw ArgumentError('Difficulty must be between 1 and 8');
    }
    
    _difficulty = newDifficulty;
    _miningMetrics['currentDifficulty'] = _difficulty;
    
    debugPrint('⚙️ Difficulty set to $_difficulty');
    _emitLog('Difficulty manually set to $_difficulty');
    _emitStatus('difficulty_changed', {'newDifficulty': _difficulty});
    
    // If currently mining, restart with new difficulty
    if (_isMining) {
      await stopMining();
      await startMining();
    }
  }

  Future<void> resetMetrics() async {
    _miningMetrics = {
      'hashesComputed': 0,
      'totalHashRate': 0.0,
      'averageHashRate': 0.0,
      'blocksMined': 0,
      'totalMiningTime': 0,
      'lastBlockTime': null,
      'currentDifficulty': _difficulty,
      'efficiency': 0.0,
    };
    
    _lastValidHash = null;
    
    await _saveMiningMetrics();
    
    debugPrint('📊 Mining metrics reset');
    _emitLog('Mining metrics reset');
    _emitStatus('metrics_reset', null);
  }

  void _emitLog(String message) {
    _logController.add('[${DateTime.now().toIso8601String()}] $message');
  }

  void _emitStatus(String type, dynamic data) {
    _statusController.add({
      'type': type,
      'data': data,
      'timestamp': DateTime.now().toIso8601String(),
    });
  }

  Future<void> dispose() async {
    await stopMining();
    await _statusController.close();
    await _blockController.close();
    await _logController.close();
  }
}
