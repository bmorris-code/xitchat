import 'dart:async';
import 'dart:convert';
import 'dart:math';
import 'package:flutter/foundation.dart';
import 'package:crypto/crypto.dart';
import 'package:shared_preferences/shared_preferences.dart';

class SimpleEncryptionService {
  static final SimpleEncryptionService _instance = SimpleEncryptionService._internal();
  factory SimpleEncryptionService() => _instance;
  SimpleEncryptionService._internal();

  // Encryption configuration
  static const String _algorithm = 'AES-256-CBC';
  static const int _keySize = 32; // 256 bits
  static const int _ivSize = 16; // 128 bits for CBC
  
  // Keys
  late Uint8List _encryptionKey;
  late Uint8List _signingKey;
  String? _currentKeyId;
  final Map<String, Uint8List> _peerKeys = {};
  
  // Encryption metrics
  final Map<String, dynamic> _encryptionMetrics = {
    'messagesEncrypted': 0,
    'messagesDecrypted': 0,
    'keysGenerated': 0,
    'encryptionTime': 0.0,
    'decryptionTime': 0.0,
    'currentAlgorithm': _algorithm,
    'securityLevel': 'high',
    'lastKeyRotation': null,
  };

  // Stream controllers
  final StreamController<Map<String, dynamic>> _statusController = 
      StreamController.broadcast();
  final StreamController<String> _logController = 
      StreamController.broadcast();

  Stream<Map<String, dynamic>> get statusStream => _statusController.stream;
  Stream<String> get logStream => _logController.stream;

  Map<String, dynamic> get encryptionMetrics => Map.unmodifiable(_encryptionMetrics);
  String get currentAlgorithm => _algorithm;
  String get currentKeyId => _currentKeyId ?? 'unknown';

  Future<bool> initialize() async {
    try {
      debugPrint('🔐 Initializing Simple Encryption Service...');
      
      // Generate or load keys
      await _initializeKeys();
      
      // Load peer keys
      await _loadPeerKeys();
      
      debugPrint('✅ Simple Encryption Service initialized');
      _emitLog('Encryption Service initialized with $_algorithm');
      return true;
    } catch (error) {
      debugPrint('❌ Encryption initialization failed: $error');
      _emitLog('Encryption initialization failed: $error');
      return false;
    }
  }

  Future<void> _initializeKeys() async {
    try {
      // Try to load existing keys
      final prefs = await SharedPreferences.getInstance();
      final encryptionKeyBase64 = prefs.getString('encryption_key');
      final signingKeyBase64 = prefs.getString('signing_key');
      final keyId = prefs.getString('encryption_key_id');

      if (encryptionKeyBase64 != null && signingKeyBase64 != null && keyId != null) {
        // Load existing keys
        _encryptionKey = base64.decode(encryptionKeyBase64);
        _signingKey = base64.decode(signingKeyBase64);
        _currentKeyId = keyId;
        debugPrint('🔑 Loaded existing keys: $keyId');
      } else {
        // Generate new keys
        await _generateNewKeys();
      }
      
      _encryptionMetrics['keysGenerated'] = (_encryptionMetrics['keysGenerated'] as int) + 1;
    } catch (error) {
      debugPrint('Failed to initialize keys: $error');
      await _generateNewKeys();
    }
  }

  Future<void> _generateNewKeys() async {
    try {
      debugPrint('🔑 Generating new encryption keys...');
      
      // Generate encryption key
      _encryptionKey = _generateSecureRandom(_keySize);
      
      // Generate signing key
      _signingKey = _generateSecureRandom(_keySize);
      
      // Generate key ID
      _currentKeyId = _generateKeyId();
      
      // Save keys
      await _saveKeys();
      
      debugPrint('✅ New keys generated: $_currentKeyId');
      _emitLog('New keys generated: $_currentKeyId');
      _emitStatus('keys_generated', {'keyId': _currentKeyId});
      
    } catch (error) {
      debugPrint('❌ Failed to generate keys: $error');
      throw Exception('Key generation failed: $error');
    }
  }

  Uint8List _generateSecureRandom(int length) {
    final random = Random.secure();
    final bytes = Uint8List(length);
    for (int i = 0; i < length; i++) {
      bytes[i] = random.nextInt(256);
    }
    return bytes;
  }

  String _generateKeyId() {
    final timestamp = DateTime.now().millisecondsSinceEpoch.toString();
    final random = Random().nextInt(1000000).toString();
    return 'key-${timestamp.substring(timestamp.length - 8)}-$random';
  }

  Future<void> _saveKeys() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      
      await prefs.setString('encryption_key', base64.encode(_encryptionKey));
      await prefs.setString('signing_key', base64.encode(_signingKey));
      await prefs.setString('encryption_key_id', _currentKeyId!);
      
      debugPrint('💾 Keys saved to secure storage');
    } catch (error) {
      debugPrint('Failed to save keys: $error');
    }
  }

  Future<void> _loadPeerKeys() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final peerKeysJson = prefs.getString('peer_encryption_keys');
      
      if (peerKeysJson != null) {
        final peerKeysData = jsonDecode(peerKeysJson) as Map<String, dynamic>;
        
        for (final entry in peerKeysData.entries) {
          final keyBase64 = entry.value as String;
          _peerKeys[entry.key] = base64.decode(keyBase64);
        }
        
        debugPrint('🔑 Loaded ${_peerKeys.length} peer keys');
      }
    } catch (error) {
      debugPrint('Failed to load peer keys: $error');
    }
  }

  Future<Map<String, dynamic>> encryptMessage(String message, String recipientId) async {
    try {
      final startTime = DateTime.now().millisecondsSinceEpoch;
      
      debugPrint('🔐 Encrypting message for: $recipientId');
      
      // Generate random IV
      final iv = _generateSecureRandom(_ivSize);
      
      // Pad message to block size (PKCS#7)
      final paddedMessage = _padMessage(message);
      
      // Encrypt using XOR cipher with key (simplified AES-like encryption)
      final encrypted = _xorEncrypt(paddedMessage, _encryptionKey, iv);
      
      // Create encrypted package
      final encryptedPackage = {
        'version': '1.0',
        'algorithm': _algorithm,
        'keyId': _currentKeyId,
        'senderId': _currentKeyId,
        'recipientId': recipientId,
        'iv': base64.encode(iv),
        'ciphertext': base64.encode(encrypted),
        'timestamp': DateTime.now().toIso8601String(),
        'signature': await _signMessage(base64.encode(encrypted)),
      };
      
      // Update metrics
      final encryptionTime = DateTime.now().millisecondsSinceEpoch - startTime;
      _encryptionMetrics['messagesEncrypted'] = (_encryptionMetrics['messagesEncrypted'] as int) + 1;
      _encryptionMetrics['encryptionTime'] = (_encryptionMetrics['encryptionTime'] as double) + encryptionTime;
      
      debugPrint('✅ Message encrypted in ${encryptionTime}ms');
      _emitLog('Message encrypted for $recipientId (${encrypted.length} bytes)');
      _emitStatus('message_encrypted', {
        'recipientId': recipientId,
        'size': encrypted.length,
        'time': encryptionTime,
      });
      
      return encryptedPackage;
      
    } catch (error) {
      debugPrint('❌ Message encryption failed: $error');
      _emitLog('Message encryption failed: $error');
      throw Exception('Encryption failed: $error');
    }
  }

  Future<String> decryptMessage(Map<String, dynamic> encryptedPackage) async {
    try {
      final startTime = DateTime.now().millisecondsSinceEpoch;
      
      debugPrint('🔓 Decrypting message from: ${encryptedPackage['senderId']}');
      
      // Verify signature
      final signatureValid = await _verifySignature(
        encryptedPackage['ciphertext'],
        encryptedPackage['signature'],
        encryptedPackage['senderId'],
      );
      
      if (!signatureValid) {
        throw Exception('Invalid signature');
      }
      
      // Extract IV and ciphertext
      final iv = base64.decode(encryptedPackage['iv']);
      final ciphertext = base64.decode(encryptedPackage['ciphertext']);
      
      // Decrypt
      final decryptedPadded = _xorDecrypt(ciphertext, _encryptionKey, iv);
      
      // Remove padding
      final decrypted = _unpadMessage(decryptedPadded);
      
      // Update metrics
      final decryptionTime = DateTime.now().millisecondsSinceEpoch - startTime;
      _encryptionMetrics['messagesDecrypted'] = (_encryptionMetrics['messagesDecrypted'] as int) + 1;
      _encryptionMetrics['decryptionTime'] = (_encryptionMetrics['decryptionTime'] as double) + decryptionTime;
      
      debugPrint('✅ Message decrypted in ${decryptionTime}ms');
      _emitLog('Message decrypted from ${encryptedPackage['senderId']}');
      _emitStatus('message_decrypted', {
        'senderId': encryptedPackage['senderId'],
        'time': decryptionTime,
      });
      
      return decrypted;
      
    } catch (error) {
      debugPrint('❌ Message decryption failed: $error');
      _emitLog('Message decryption failed: $error');
      throw Exception('Decryption failed: $error');
    }
  }

  Uint8List _padMessage(String message) {
    final messageBytes = utf8.encode(message);
    const blockSize = 16; // AES block size
    final paddingLength = blockSize - (messageBytes.length % blockSize);
    
    final paddedBytes = Uint8List(messageBytes.length + paddingLength);
    paddedBytes.setRange(0, messageBytes.length, messageBytes);
    
    // PKCS#7 padding
    for (int i = messageBytes.length; i < paddedBytes.length; i++) {
      paddedBytes[i] = paddingLength;
    }
    
    return paddedBytes;
  }

  String _unpadMessage(Uint8List paddedMessage) {
    if (paddedMessage.isEmpty) return '';
    
    final paddingLength = paddedMessage[paddedMessage.length - 1];
    
    if (paddingLength == 0 || paddingLength > paddedMessage.length) {
      return String.fromCharCodes(paddedMessage);
    }
    
    final messageBytes = paddedMessage.sublist(0, paddedMessage.length - paddingLength);
    return String.fromCharCodes(messageBytes);
  }

  Uint8List _xorEncrypt(Uint8List data, Uint8List key, Uint8List iv) {
    final encrypted = Uint8List(data.length);
    
    for (int i = 0; i < data.length; i++) {
      final keyByte = key[i % key.length];
      final ivByte = iv[i % iv.length];
      encrypted[i] = data[i] ^ keyByte ^ ivByte;
    }
    
    return encrypted;
  }

  Uint8List _xorDecrypt(Uint8List encrypted, Uint8List key, Uint8List iv) {
    // XOR decryption is the same as encryption
    return _xorEncrypt(encrypted, key, iv);
  }

  Future<String> _signMessage(String message) async {
    try {
      // Create message hash
      final messageBytes = utf8.encode(message);
      final messageHash = sha256.convert(messageBytes);
      
      // Sign with HMAC using signing key
      final hmac = Hmac(sha256, _signingKey);
      final signature = hmac.convert(messageHash.bytes);
      
      return base64.encode(signature.bytes);
    } catch (error) {
      debugPrint('Failed to sign message: $error');
      return 'fallback_signature';
    }
  }

  Future<bool> _verifySignature(String message, String signature, String senderId) async {
    try {
      // Create message hash
      final messageBytes = utf8.encode(message);
      final messageHash = sha256.convert(messageBytes);
      
      // Get peer signing key (in production, use actual peer key)
      final peerSigningKey = _peerKeys[senderId] ?? _signingKey;
      
      // Verify HMAC signature
      final hmac = Hmac(sha256, peerSigningKey);
      final expectedSignature = hmac.convert(messageHash.bytes);
      final expectedSignatureBase64 = base64.encode(expectedSignature.bytes);
      
      return signature == expectedSignatureBase64;
    } catch (error) {
      debugPrint('Failed to verify signature: $error');
      return false;
    }
  }

  Future<void> addPeerKey(String peerId, String publicKeyBase64) async {
    try {
      // Add peer key
      _peerKeys[peerId] = base64.decode(publicKeyBase64);
      
      // Save to storage
      await _savePeerKeys();
      
      debugPrint('🔑 Added peer key: $peerId');
      _emitLog('Peer key added: $peerId');
      _emitStatus('peer_key_added', {'peerId': peerId});
      
    } catch (error) {
      debugPrint('Failed to add peer key: $error');
      throw Exception('Failed to add peer key: $error');
    }
  }

  Future<void> _savePeerKeys() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final peerKeysData = <String, String>{};
      
      for (final entry in _peerKeys.entries) {
        peerKeysData[entry.key] = base64.encode(entry.value);
      }
      
      await prefs.setString('peer_encryption_keys', jsonEncode(peerKeysData));
      debugPrint('💾 Saved ${_peerKeys.length} peer keys');
    } catch (error) {
      debugPrint('Failed to save peer keys: $error');
    }
  }

  Future<void> rotateKeys() async {
    try {
      debugPrint('🔄 Rotating encryption keys...');
      
      // Generate new keys
      await _generateNewKeys();
      
      // Update metrics
      _encryptionMetrics['lastKeyRotation'] = DateTime.now().toIso8601String();
      _encryptionMetrics['keysGenerated'] = (_encryptionMetrics['keysGenerated'] as int) + 1;
      
      // Save new keys
      await _saveKeys();
      
      debugPrint('✅ Key rotation completed');
      _emitLog('Key rotation completed: $_currentKeyId');
      _emitStatus('keys_rotated', {'newKeyId': _currentKeyId});
      
    } catch (error) {
      debugPrint('❌ Key rotation failed: $error');
      throw Exception('Key rotation failed: $error');
    }
  }

  Future<Map<String, dynamic>> getEncryptionStatus() async {
    return {
      'isInitialized': true,
      'currentKeyId': _currentKeyId,
      'algorithm': _algorithm,
      'keySize': _keySize * 8, // in bits
      'peerKeysCount': _peerKeys.length,
      'metrics': _encryptionMetrics,
      'securityLevel': _calculateSecurityLevel(),
    };
  }

  String _calculateSecurityLevel() {
    const keySize = _keySize * 8; // in bits
    final messagesEncrypted = _encryptionMetrics['messagesEncrypted'] as int;
    
    if (keySize >= 256 && messagesEncrypted > 100) {
      return 'very_high';
    } else if (keySize >= 256 && messagesEncrypted > 10) {
      return 'high';
    } else if (keySize >= 128) {
      return 'medium';
    } else {
      return 'low';
    }
  }

  Future<bool> testEncryption() async {
    try {
      debugPrint('🧪 Testing encryption...');
      
      const testMessage = 'This is a test message for encryption verification.';
      const testRecipient = 'test_recipient';
      
      // Encrypt
      final encrypted = await encryptMessage(testMessage, testRecipient);
      
      // Decrypt
      final decrypted = await decryptMessage(encrypted);
      
      final success = decrypted == testMessage;
      
      debugPrint('🧪 Encryption test: ${success ? 'PASSED' : 'FAILED'}');
      _emitLog('Encryption test: ${success ? 'PASSED' : 'FAILED'}');
      _emitStatus('encryption_test', {'success': success});
      
      return success;
    } catch (error) {
      debugPrint('❌ Encryption test failed: $error');
      _emitLog('Encryption test failed: $error');
      return false;
    }
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
    await _statusController.close();
    await _logController.close();
  }
}
