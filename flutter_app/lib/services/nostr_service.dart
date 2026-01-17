import 'dart:async';
import 'dart:convert';
import 'dart:math';
import 'package:flutter/foundation.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:crypto/crypto.dart';
import 'package:web_socket_channel/web_socket_channel.dart';

/// Nostr Peer representation
class NostrPeer {
  final String id;
  final String publicKey;
  final String? name;
  final String? picture;
  final String? about;
  final String? nip05;
  final DateTime lastSeen;
  final bool isConnected;

  NostrPeer({
    required this.id,
    required this.publicKey,
    this.name,
    this.picture,
    this.about,
    this.nip05,
    required this.lastSeen,
    required this.isConnected,
  });

  Map<String, dynamic> toJson() => {
        'id': id,
        'publicKey': publicKey,
        'name': name,
        'picture': picture,
        'about': about,
        'nip05': nip05,
        'lastSeen': lastSeen.toIso8601String(),
        'isConnected': isConnected,
      };
}

/// Nostr Message representation
class NostrMessage {
  final String id;
  final String pubkey;
  final int createdAt;
  final int kind;
  final List<List<String>> tags;
  final String content;
  final String sig;

  NostrMessage({
    required this.id,
    required this.pubkey,
    required this.createdAt,
    required this.kind,
    required this.tags,
    required this.content,
    required this.sig,
  });

  Map<String, dynamic> toJson() => {
        'id': id,
        'pubkey': pubkey,
        'created_at': createdAt,
        'kind': kind,
        'tags': tags,
        'content': content,
        'sig': sig,
      };

  factory NostrMessage.fromJson(Map<String, dynamic> json) {
    return NostrMessage(
      id: json['id'],
      pubkey: json['pubkey'],
      createdAt: json['created_at'],
      kind: json['kind'],
      tags: (json['tags'] as List)
          .map((t) => (t as List).map((e) => e.toString()).toList())
          .toList(),
      content: json['content'],
      sig: json['sig'],
    );
  }
}

/// Nostr Channel representation
class NostrChannel {
  final String id;
  final String name;
  final String about;
  final String? picture;
  final List<String> creators;
  final List<String> participants;
  final bool isPublic;
  final int createdAt;

  NostrChannel({
    required this.id,
    required this.name,
    required this.about,
    this.picture,
    required this.creators,
    required this.participants,
    required this.isPublic,
    required this.createdAt,
  });
}

/// Nostr Service for Flutter
/// Implements decentralized global communication using Nostr relays
class NostrService {
  String? _privateKey;
  String? _publicKey;
  final Map<String, WebSocketChannel> _relayConnections = {};
  final Set<String> _connectedRelays = {};
  final Map<String, NostrPeer> _peers = {};
  final Map<String, NostrChannel> _channels = {};
  final StreamController<Map<String, dynamic>> _eventController =
      StreamController.broadcast();
  bool _isInitialized = false;

  // Default public Nostr relays
  final List<String> defaultRelays = [
    'wss://relay.damus.io',
    'wss://relay.nostr.band',
    'wss://nos.lol',
    'wss://relay.snort.social',
    'wss://relay.current.fyi',
    'wss://nostr.wine',
    'wss://relay.primal.net',
  ];

  Stream<Map<String, dynamic>> get events => _eventController.stream;
  bool get isInitialized => _isInitialized;
  String? get publicKey => _publicKey;
  List<NostrPeer> get peers => _peers.values.toList();
  List<NostrChannel> get channels => _channels.values.toList();

  /// Initialize Nostr service
  Future<bool> initialize({String? privateKey}) async {
    try {
      debugPrint('🔑 Initializing Nostr service...');

      // Initialize keys
      if (privateKey != null) {
        _privateKey = privateKey;
      } else {
        final prefs = await SharedPreferences.getInstance();
        _privateKey =
            prefs.getString('nostr_private_key') ?? _generatePrivateKey();
        await prefs.setString('nostr_private_key', _privateKey!);
      }

      _publicKey = _getPublicKey(_privateKey!);
      debugPrint('🔑 Nostr public key: $_publicKey');

      // Connect to relays
      await _connectToRelays();

      // Load user profile
      await _loadUserProfile();

      // Subscribe to relevant events
      await _subscribeToEvents();

      _isInitialized = true;
      debugPrint('✅ Nostr service initialized successfully');
      _emit('initialized', {'publicKey': _publicKey});

      return true;
    } catch (error) {
      debugPrint('❌ Nostr service initialization failed: $error');
      return false;
    }
  }

  /// Generate a random private key (32 bytes hex)
  String _generatePrivateKey() {
    final random = Random.secure();
    final bytes = List<int>.generate(32, (_) => random.nextInt(256));
    return bytes.map((b) => b.toRadixString(16).padLeft(2, '0')).join();
  }

  /// Derive public key from private key (simplified - in production use secp256k1)
  String _getPublicKey(String privateKey) {
    // This is a simplified version. In production, use proper secp256k1 curve
    // For now, we'll use SHA256 as a placeholder
    final bytes = utf8.encode(privateKey);
    final digest = sha256.convert(bytes);
    return digest.toString();
  }

  /// Connect to Nostr relays
  Future<void> _connectToRelays() async {
    debugPrint('🌐 Connecting to Nostr relays...');

    for (final relayUrl in defaultRelays) {
      try {
        final channel = WebSocketChannel.connect(Uri.parse(relayUrl));
        _relayConnections[relayUrl] = channel;

        // Listen to relay messages
        channel.stream.listen(
          (message) => _handleRelayMessage(relayUrl, message),
          onError: (error) {
            debugPrint('❌ Relay error ($relayUrl): $error');
            _connectedRelays.remove(relayUrl);
          },
          onDone: () {
            debugPrint('🔌 Relay disconnected: $relayUrl');
            _connectedRelays.remove(relayUrl);
          },
        );

        _connectedRelays.add(relayUrl);
        debugPrint('✅ Connected to relay: $relayUrl');
      } catch (error) {
        debugPrint('⚠️ Failed to connect to relay $relayUrl: $error');
      }
    }

    debugPrint('🌐 Connected to ${_connectedRelays.length} relays');
  }

  /// Handle incoming relay messages
  void _handleRelayMessage(String relayUrl, dynamic message) {
    try {
      final data = jsonDecode(message);
      if (data is List && data.isNotEmpty) {
        final messageType = data[0];

        switch (messageType) {
          case 'EVENT':
            if (data.length >= 3) {
              final event = data[2];
              _handleEvent(event);
            }
            break;
          case 'NOTICE':
            debugPrint('📢 Relay notice from $relayUrl: ${data[1]}');
            break;
          case 'EOSE':
            debugPrint('✅ End of stored events from $relayUrl');
            break;
          case 'OK':
            debugPrint('✅ Event published to $relayUrl');
            break;
        }
      }
    } catch (error) {
      debugPrint('❌ Failed to parse relay message: $error');
    }
  }

  /// Handle Nostr event
  void _handleEvent(Map<String, dynamic> eventData) {
    try {
      final event = NostrMessage.fromJson(eventData);

      switch (event.kind) {
        case 0: // Metadata
          _handleMetadataEvent(event);
          break;
        case 1: // Text note
          _handleTextNote(event);
          break;
        case 4: // Encrypted direct message
          _handleDirectMessage(event);
          break;
        case 40: // Channel creation
          _handleChannelCreation(event);
          break;
        case 41: // Channel metadata
          _handleChannelMetadata(event);
          break;
        case 42: // Channel message
          _handleChannelMessage(event);
          break;
      }
    } catch (error) {
      debugPrint('❌ Failed to handle event: $error');
    }
  }

  /// Handle metadata event (kind 0)
  void _handleMetadataEvent(NostrMessage event) {
    try {
      final metadata = jsonDecode(event.content);
      final peer = NostrPeer(
        id: event.pubkey,
        publicKey: event.pubkey,
        name: metadata['name'],
        picture: metadata['picture'],
        about: metadata['about'],
        nip05: metadata['nip05'],
        lastSeen: DateTime.fromMillisecondsSinceEpoch(event.createdAt * 1000),
        isConnected: true,
      );

      _peers[event.pubkey] = peer;
      _emit('peerUpdated', peer.toJson());
    } catch (error) {
      debugPrint('❌ Failed to handle metadata event: $error');
    }
  }

  /// Handle text note (kind 1)
  void _handleTextNote(NostrMessage event) {
    debugPrint('📝 Received text note from ${event.pubkey}');
    _emit('textNoteReceived', {
      'from': event.pubkey,
      'content': event.content,
      'timestamp': DateTime.fromMillisecondsSinceEpoch(event.createdAt * 1000),
    });
  }

  /// Handle direct message (kind 4)
  Future<void> _handleDirectMessage(NostrMessage event) async {
    try {
      // In production, decrypt using NIP-04
      // For now, we'll emit the encrypted content
      debugPrint('📨 Received direct message from ${event.pubkey}');

      _emit('messageReceived', {
        'id': event.id,
        'from': event.pubkey,
        'to': _publicKey,
        'content': event.content, // Should be decrypted
        'timestamp':
            DateTime.fromMillisecondsSinceEpoch(event.createdAt * 1000),
        'type': 'direct',
      });
    } catch (error) {
      debugPrint('❌ Failed to handle direct message: $error');
    }
  }

  /// Handle channel creation (kind 40)
  void _handleChannelCreation(NostrMessage event) {
    try {
      final metadata = jsonDecode(event.content);
      final channel = NostrChannel(
        id: event.id,
        name: metadata['name'] ?? 'Unnamed Channel',
        about: metadata['about'] ?? '',
        picture: metadata['picture'],
        creators: [event.pubkey],
        participants: [event.pubkey],
        isPublic: true,
        createdAt: event.createdAt,
      );

      _channels[event.id] = channel;
      _emit('channelCreated', {'channel': channel});
    } catch (error) {
      debugPrint('❌ Failed to handle channel creation: $error');
    }
  }

  /// Handle channel metadata (kind 41)
  void _handleChannelMetadata(NostrMessage event) {
    debugPrint('📢 Channel metadata updated');
  }

  /// Handle channel message (kind 42)
  void _handleChannelMessage(NostrMessage event) {
    debugPrint('💬 Channel message received');
    _emit('channelMessageReceived', {
      'from': event.pubkey,
      'content': event.content,
      'timestamp': DateTime.fromMillisecondsSinceEpoch(event.createdAt * 1000),
    });
  }

  /// Load user profile
  Future<void> _loadUserProfile() async {
    if (_publicKey == null) return;

    try {
      // Request metadata for our public key
      final filter = {
        'kinds': [0],
        'authors': [_publicKey],
        'limit': 1,
      };

      _subscribeToFilter(filter, 'profile');
    } catch (error) {
      debugPrint('⚠️ Failed to load user profile: $error');
    }
  }

  /// Subscribe to relevant events
  Future<void> _subscribeToEvents() async {
    if (_publicKey == null) return;

    try {
      // Subscribe to direct messages
      final dmFilter = {
        'kinds': [4],
        '#p': [_publicKey],
      };
      _subscribeToFilter(dmFilter, 'dms');

      // Subscribe to mentions
      final mentionFilter = {
        'kinds': [1],
        '#p': [_publicKey],
      };
      _subscribeToFilter(mentionFilter, 'mentions');

      debugPrint('👂 Subscribed to Nostr events');
    } catch (error) {
      debugPrint('⚠️ Failed to subscribe to events: $error');
    }
  }

  /// Subscribe to a filter on all relays
  void _subscribeToFilter(Map<String, dynamic> filter, String subscriptionId) {
    final request = jsonEncode(['REQ', subscriptionId, filter]);

    for (final relay in _relayConnections.values) {
      try {
        relay.sink.add(request);
      } catch (error) {
        debugPrint('❌ Failed to send subscription to relay: $error');
      }
    }
  }

  /// Send direct message
  Future<bool> sendDirectMessage(
      String recipientPublicKey, String content) async {
    try {
      if (_privateKey == null || _publicKey == null) {
        throw Exception('Nostr service not initialized');
      }

      // In production, encrypt using NIP-04
      // For now, we'll send plaintext (NOT SECURE - for demo only)
      final encryptedContent = content; // Should be encrypted

      final event = _createEvent(
        kind: 4,
        content: encryptedContent,
        tags: [
          ['p', recipientPublicKey]
        ],
      );

      await _publishEvent(event);
      debugPrint('📤 Sent direct message to $recipientPublicKey');
      return true;
    } catch (error) {
      debugPrint('❌ Failed to send direct message: $error');
      return false;
    }
  }

  /// Create a Nostr event
  Map<String, dynamic> _createEvent({
    required int kind,
    required String content,
    List<List<String>>? tags,
  }) {
    final createdAt = DateTime.now().millisecondsSinceEpoch ~/ 1000;
    tags ??= [];

    // Create event structure
    final event = {
      'pubkey': _publicKey,
      'created_at': createdAt,
      'kind': kind,
      'tags': tags,
      'content': content,
    };

    // Calculate event ID (SHA256 of serialized event)
    final serialized = jsonEncode([
      0,
      _publicKey,
      createdAt,
      kind,
      tags,
      content,
    ]);
    final eventId = sha256.convert(utf8.encode(serialized)).toString();
    event['id'] = eventId;

    // Sign event (simplified - in production use secp256k1)
    event['sig'] = _signEvent(eventId);

    return event;
  }

  /// Sign event (simplified - in production use secp256k1)
  String _signEvent(String eventId) {
    // This is a placeholder. In production, use proper secp256k1 signing
    final combined = '$_privateKey$eventId';
    return sha256.convert(utf8.encode(combined)).toString();
  }

  /// Publish event to all connected relays
  Future<void> _publishEvent(Map<String, dynamic> event) async {
    final request = jsonEncode(['EVENT', event]);

    for (final relay in _relayConnections.values) {
      try {
        relay.sink.add(request);
      } catch (error) {
        debugPrint('❌ Failed to publish to relay: $error');
      }
    }
  }

  /// Update user profile
  Future<bool> updateProfile(
      {String? name, String? about, String? picture}) async {
    try {
      if (_privateKey == null || _publicKey == null) {
        throw Exception('Nostr service not initialized');
      }

      final metadata = {
        if (name != null) 'name': name,
        if (about != null) 'about': about,
        if (picture != null) 'picture': picture,
      };

      final event = _createEvent(
        kind: 0,
        content: jsonEncode(metadata),
        tags: [],
      );

      await _publishEvent(event);
      debugPrint('👤 Updated profile metadata');
      _emit('profileUpdated', metadata);
      return true;
    } catch (error) {
      debugPrint('❌ Failed to update profile: $error');
      return false;
    }
  }

  /// Emit event to listeners
  void _emit(String event, dynamic data) {
    _eventController.add({event: data});
  }

  /// Disconnect from all relays
  Future<void> disconnect() async {
    for (final relay in _relayConnections.values) {
      await relay.sink.close();
    }
    _relayConnections.clear();
    _connectedRelays.clear();
    _isInitialized = false;
    debugPrint('🔌 Disconnected from all Nostr relays');
  }

  /// Dispose resources
  void dispose() {
    disconnect();
    _eventController.close();
  }
}
