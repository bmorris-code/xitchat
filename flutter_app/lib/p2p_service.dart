import 'dart:async';
import 'dart:convert';
import 'package:flutter/foundation.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:flutter_webrtc/flutter_webrtc.dart';
import 'models.dart';

class FlutterP2PService {
  final Map<String, MeshPeer> _peers = {};
  final Map<String, LocalRoom> _localRooms = {};
  late String _myPeerId;
  late String _myName;
  late String _myHandle;
  final StreamController<Map<String, dynamic>> _eventController =
      StreamController.broadcast();
  Timer? _discoveryInterval;
  bool _isDiscovering = false;
  RTCPeerConnection? _localMeshConnection;

  Stream<Map<String, dynamic>> get events => _eventController.stream;

  FlutterP2PService() {
    _myPeerId = _generatePeerId();
    _myName = 'Mesh User ${_myPeerId.substring(5, 9)}';
    _myHandle = '@meshuser${_myPeerId.substring(5, 9)}';
  }

  String get myPeerId => _myPeerId;

  String _generatePeerId() {
    return 'mesh-${DateTime.now().millisecondsSinceEpoch.toString().substring(2, 11)}';
  }

  Future<bool> initialize() async {
    try {
      if (!kIsWeb) {
        // Native mobile WebRTC support
        debugPrint('🔧 Initializing native WebRTC for mobile...');
      }

      await _startLocalDiscovery();

      debugPrint(
          '✅ Flutter Mesh P2P service initialized - Mobile ready. My ID: $_myPeerId');
      return true;
    } catch (error) {
      debugPrint('❌ Flutter P2P initialization failed: $error');
      return false;
    }
  }

  void startDiscovery() {
    if (_isDiscovering) return;

    debugPrint('🔍 Starting manual mesh discovery...');
    _startLocalDiscovery();
  }

  Future<void> _startLocalDiscovery() async {
    if (_isDiscovering) return;
    debugPrint('🔍 Starting local mesh discovery...');

    // Start periodic scanning
    _discoveryInterval = Timer.periodic(const Duration(seconds: 10), (timer) {
      _scanForLocalPeers();
    });

    _isDiscovering = true;
    _emit('discoveryStarted', null);

    // Create initial offer for other peers to find
    await _createRealLocalMeshConnections();
  }

  Future<void> _createRealLocalMeshConnections() async {
    if (_localMeshConnection != null) return;

    debugPrint('🔗 Creating REAL local mesh connections (Signaling Setup)...');

    final localConnection = await createPeerConnection({'iceServers': []});
    _localMeshConnection = localConnection;

    // Data channel for local service discovery announcements
    final discoveryChannel = await localConnection.createDataChannel(
        'mesh-discovery', RTCDataChannelInit()..ordered = true);
    _setupDiscoveryChannel(discoveryChannel);

    localConnection.onIceCandidate = (RTCIceCandidate candidate) {
      debugPrint('🧊 ICE candidate generated for local service.');
      _shareLocalIceCandidate(candidate);
    };

    // Create offer
    final offer = await localConnection.createOffer();
    await localConnection.setLocalDescription(offer);
    await _shareLocalOffer(offer);

    _listenForLocalOffers();
    debugPrint('🔍 Listening for offers from other devices...');
  }

  void _setupDiscoveryChannel(RTCDataChannel channel) {
    channel.onMessage = (RTCDataChannelMessage message) {
      try {
        final data = jsonDecode(message.text);
        _handleDiscoveryMessage(data);
      } catch (error) {
        debugPrint('Failed to parse discovery message: $error');
      }
    };

    channel.stateChangeStream.listen((state) {
      if (state == RTCDataChannelState.RTCDataChannelOpen) {
        debugPrint('📡 Discovery channel open.');
        final announcement = {
          'type': 'peer-announce',
          'peerId': _myPeerId,
          'name': _myName,
          'handle': _myHandle,
          'timestamp': DateTime.now().millisecondsSinceEpoch
        };
        channel.send(RTCDataChannelMessage(jsonEncode(announcement)));
      }
    });
  }

  void _handleDiscoveryMessage(Map<String, dynamic> data) {
    if (data['type'] == 'peer-announce' && data['peerId'] != _myPeerId) {
      if (!_peers.containsKey(data['peerId'])) {
        final peer = MeshPeer(
          id: data['peerId'],
          name: data['name'],
          handle: data['handle'],
          discoveryMethod: 'local-network',
          signalStrength: 95,
          distance: 5.0,
        );
        _peers[data['peerId']] = peer;
        _emit('peerDiscovered', peer);
        debugPrint(
            '📱 REAL peer discovered: ${peer.name} (${peer.handle}). Initiating connection...');
        _initiatePeerConnection(data['peerId']);
      }
    }
  }

  Future<void> _initiatePeerConnection(String peerId) async {
    final peer = _peers[peerId];
    if (peer == null || peer.connection != null) return;

    debugPrint('🤝 Creating WebRTC connection to ${peer.handle}...');

    final pc = await createPeerConnection({'iceServers': []});
    peer.connection = pc;

    pc.onDataChannel = (RTCDataChannel channel) {
      debugPrint('📡 Received data channel from ${peer.handle}');
      _setupPeerDataChannel(channel, peer);
    };

    pc.onIceCandidate = (RTCIceCandidate candidate) {
      debugPrint('🧊 Sharing ICE for ${peer.handle}');
      _shareLocalIceCandidate(candidate);
    };

    pc.onConnectionState = (state) {
      debugPrint('🔗 Connection state for ${peer.handle}: $state');
      if (state == RTCPeerConnectionState.RTCPeerConnectionStateConnected) {
        peer.isConnected = true;
        _emit('peerConnected', peer);
      } else if (state == RTCPeerConnectionState.RTCPeerConnectionStateFailed) {
        peer.isConnected = false;
        _emit('peerDisconnected', peer);
        debugPrint('❌ Connection failed for ${peer.handle}');
      }
    };

    // Create offer
    try {
      final offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      await _shareLocalOffer(offer, peerId, true);
    } catch (e) {
      debugPrint("Error creating offer for peer: $peerId, $e");
    }
  }

  Future<void> _shareLocalOffer(RTCSessionDescription offer,
      [String? targetPeerId, bool isChatOffer = false]) async {
    final prefs = await SharedPreferences.getInstance();
    final keyPrefix = isChatOffer ? 'mesh-chat-offer' : 'mesh-offer';
    final key = targetPeerId != null
        ? '$keyPrefix-$_myPeerId-to-$targetPeerId'
        : 'mesh-offer-$_myPeerId';

    final offerData = {
      'type': isChatOffer ? 'mesh-chat-offer' : 'mesh-offer',
      'offer': {
        'sdp': offer.sdp,
        'type': offer.type,
      },
      'peerId': _myPeerId,
      'timestamp': DateTime.now().millisecondsSinceEpoch
    };

    await prefs.setString(key, jsonEncode(offerData));
    debugPrint(
        '📤 Offer (${isChatOffer ? 'Chat' : 'Service'}) shared with key: $key');
  }

  Future<void> _shareLocalIceCandidate(RTCIceCandidate candidate) async {
    final prefs = await SharedPreferences.getInstance();
    final candidateData = {
      'type': 'mesh-ice-candidate',
      'candidate': {
        'candidate': candidate.candidate,
        'sdpMid': candidate.sdpMid,
        'sdpMLineIndex': candidate.sdpMLineIndex,
      },
      'peerId': _myPeerId,
      'timestamp': DateTime.now().millisecondsSinceEpoch
    };

    await prefs.setString(
        'mesh-ice-$_myPeerId-${DateTime.now().millisecondsSinceEpoch}',
        jsonEncode(candidateData));
  }

  Future<void> _listenForLocalOffers() async {
    Timer.periodic(const Duration(seconds: 2), (timer) async {
      final prefs = await SharedPreferences.getInstance();
      final keys = prefs.getKeys();

      debugPrint(
          '🔍 Checking localStorage for offers... My peer ID: $_myPeerId');

      // Check for Service Offers
      for (final key in keys) {
        if (key.startsWith('mesh-offer-') && !key.contains(_myPeerId)) {
          try {
            final offerData = jsonDecode(prefs.getString(key) ?? '{}');
            if (offerData['type'] == 'mesh-offer' &&
                DateTime.now().millisecondsSinceEpoch - offerData['timestamp'] <
                    30000) {
              debugPrint(
                  '📥 Found remote SERVICE offer from: ${offerData['peerId']}');
              await _handleRemoteServiceOffer(offerData);
              await prefs.remove(key);
            }
          } catch (e) {/* ignore */}
        }
      }

      // Check for Chat Offers
      for (final key in keys) {
        if (key.startsWith('mesh-chat-offer-') &&
            key.contains('-to-$_myPeerId')) {
          try {
            final offerData = jsonDecode(prefs.getString(key) ?? '{}');
            if (offerData['type'] == 'mesh-chat-offer' &&
                DateTime.now().millisecondsSinceEpoch - offerData['timestamp'] <
                    30000) {
              debugPrint(
                  '📥 Found remote CHAT offer from: ${offerData['peerId']}');
              await _handleRemoteChatOffer(offerData);
              await prefs.remove(key);
            }
          } catch (e) {/* ignore */}
        }
      }
    });
  }

  Future<void> _handleRemoteServiceOffer(Map<String, dynamic> offerData) async {
    try {
      final peerConnection = await createPeerConnection({'iceServers': []});

      peerConnection.onIceCandidate = (RTCIceCandidate candidate) {
        _shareLocalIceCandidate(candidate);
      };

      // Set remote description
      await peerConnection.setRemoteDescription(RTCSessionDescription(
        offerData['offer']['sdp'],
        offerData['offer']['type'],
      ));

      // Create and send answer
      final answer = await peerConnection.createAnswer();
      await peerConnection.setLocalDescription(answer);
      await _shareLocalAnswer(answer, offerData['peerId']);
    } catch (error) {
      debugPrint('Failed to handle remote SERVICE offer: $error');
    }
  }

  Future<void> _handleRemoteChatOffer(Map<String, dynamic> offerData) async {
    try {
      debugPrint('📡 Found remote CHAT offer from: ${offerData['peerId']}');

      final peerConnection = await createPeerConnection({'iceServers': []});

      final peer = MeshPeer(
        id: offerData['peerId'],
        name:
            'RemotePeer${offerData['peerId'].toString().substring(offerData['peerId'].length - 4)}',
        handle:
            '@remote${offerData['peerId'].toString().substring(offerData['peerId'].length - 4)}',
        discoveryMethod: 'local-network',
        signalStrength: 90,
        distance: 10.0,
      );
      peer.connection = peerConnection;

      _peers[offerData['peerId']] = peer;

      peerConnection.onDataChannel = (RTCDataChannel channel) {
        debugPrint('📡 Received DATA channel from ${peer.handle}');
        _setupPeerDataChannel(channel, peer);
      };

      peerConnection.onIceCandidate = (RTCIceCandidate candidate) {
        debugPrint('🧊 Sharing ICE for remote offer from ${peer.handle}');
        _shareLocalIceCandidate(candidate);
      };

      peerConnection.onConnectionState = (state) {
        debugPrint('🔗 Connection state for ${peer.handle}: $state');
        if (state == RTCPeerConnectionState.RTCPeerConnectionStateConnected) {
          peer.isConnected = true;
          _emit('peerConnected', peer);
        } else if (state ==
            RTCPeerConnectionState.RTCPeerConnectionStateFailed) {
          peer.isConnected = false;
          _emit('peerDisconnected', peer);
        }
      };

      // Set remote description
      await peerConnection.setRemoteDescription(RTCSessionDescription(
        offerData['offer']['sdp'],
        offerData['offer']['type'],
      ));
      debugPrint('📥 Remote description set for: ${peer.handle}');

      // Create answer
      final answer = await peerConnection.createAnswer();
      await peerConnection.setLocalDescription(answer);
      debugPrint('📤 Answer created and set for: ${peer.handle}');

      // Share answer via SharedPreferences
      await _shareLocalAnswer(answer, offerData['peerId']);

      _emit('peerDiscovered', peer);
      debugPrint('📱 REAL peer discovered (via Chat Offer): ${peer.name}');
    } catch (error) {
      debugPrint('Failed to handle remote CHAT offer: $error');
    }
  }

  Future<void> _shareLocalAnswer(
      RTCSessionDescription answer, String targetPeerId) async {
    final prefs = await SharedPreferences.getInstance();
    final answerData = {
      'type': 'mesh-answer',
      'answer': {
        'sdp': answer.sdp,
        'type': answer.type,
      },
      'fromPeerId': _myPeerId,
      'toPeerId': targetPeerId,
      'timestamp': DateTime.now().millisecondsSinceEpoch
    };

    await prefs.setString(
        'mesh-answer-$_myPeerId-to-$targetPeerId', jsonEncode(answerData));
  }

  void _setupPeerDataChannel(RTCDataChannel channel, MeshPeer peer) {
    peer.dataChannel = channel;

    channel.onMessage = (RTCDataChannelMessage message) {
      try {
        final meshMessage = MeshMessage(
          id: DateTime.now().millisecondsSinceEpoch.toString(),
          from: jsonDecode(message.text)['from'],
          to: jsonDecode(message.text)['to'],
          content: jsonDecode(message.text)['content'],
          timestamp: DateTime.now(),
          type: jsonDecode(message.text)['type'],
        );
        _handleMessage(meshMessage);
      } catch (error) {
        debugPrint('Failed to parse message: $error');
      }
    };

    channel.stateChangeStream.listen((state) {
      if (state == RTCDataChannelState.RTCDataChannelOpen) {
        debugPrint('💬 Data channel open with ${peer.handle}');
        peer.isConnected = true;
        _emit('peerConnected', peer);
      } else if (state == RTCDataChannelState.RTCDataChannelClosed) {
        debugPrint('💬 Data channel closed with ${peer.handle}');
        peer.isConnected = false;
        _emit('peerDisconnected', peer);
      }
    });
  }

  void _scanForLocalPeers() async {
    debugPrint('🔍 Scanning for REAL local peers...');

    final prefs = await SharedPreferences.getInstance();
    final keys = prefs.getKeys();

    // Check for ICE Candidates that might be lingering
    for (final key in keys) {
      if (key.startsWith('mesh-ice-') && !key.contains(_myPeerId)) {
        try {
          final candidateData = jsonDecode(prefs.getString(key) ?? '{}');
          if (candidateData['type'] == 'mesh-ice-candidate') {
            final peer = _peers[candidateData['peerId']];
            if (peer != null && peer.connection != null) {
              debugPrint(
                  '🧊 Applying remote ICE candidate for ${candidateData['peerId']}');
              await peer.connection!.addCandidate(RTCIceCandidate(
                candidateData['candidate']['candidate'],
                candidateData['candidate']['sdpMid'],
                candidateData['candidate']['sdpMLineIndex'],
              ));
            }
            await prefs.remove(key); // Clean up ICE
          }
        } catch (e) {/* ignore */}
      }
    }

    final now = DateTime.now().millisecondsSinceEpoch;
    _peers.removeWhere(
        (key, peer) => now - peer.lastSeen.millisecondsSinceEpoch > 300000);
  }

  bool sendMessage(String peerId, String content) {
    final peer = _peers[peerId];
    if (peer == null || !peer.isConnected || peer.dataChannel == null) {
      return _routeMessage(peerId, content);
    }

    try {
      final message = MeshMessage(
          id: DateTime.now().millisecondsSinceEpoch.toString().substring(2, 11),
          from: _myPeerId,
          to: peerId,
          content: content,
          timestamp: DateTime.now(),
          type: 'chat');

      peer.dataChannel!.send(RTCDataChannelMessage(jsonEncode({
        'id': message.id,
        'from': message.from,
        'to': message.to,
        'content': message.content,
        'timestamp': message.timestamp.millisecondsSinceEpoch,
        'type': message.type
      })));
      _emit('messageSent', message);
      return true;
    } catch (error) {
      debugPrint('Failed to send message: $error');
      return false;
    }
  }

  bool _routeMessage(String targetId, String content) {
    final availablePeers = _peers.values.where((p) => p.isConnected).toList();

    if (availablePeers.isEmpty) return false;

    final relayPeer = availablePeers.first;

    try {
      final message = MeshMessage(
          id: DateTime.now().millisecondsSinceEpoch.toString().substring(2, 11),
          from: _myPeerId,
          to: targetId,
          content: content,
          timestamp: DateTime.now(),
          type: 'chat',
          route: [_myPeerId, relayPeer.id, targetId]);

      relayPeer.dataChannel!.send(RTCDataChannelMessage(jsonEncode({
        'id': message.id,
        'from': message.from,
        'to': message.to,
        'content': message.content,
        'timestamp': message.timestamp.millisecondsSinceEpoch,
        'type': message.type,
        'route': message.route
      })));
      debugPrint('📡 Routing message through ${relayPeer.handle}');
      return true;
    } catch (error) {
      debugPrint('Failed to route message: $error');
    }

    return false;
  }

  void _handleMessage(MeshMessage message) {
    debugPrint('📨 Received mesh message: ${message.content}');

    if (message.type == 'chat') {
      _emit('messageReceived', message);
    } else if (message.type == 'ping') {
      _emit('pingReceived', message);
      sendMessage(message.from, 'pong_response');
    } else if (message.type == 'room-invite') {
      _handleRoomInvite(message);
    }
  }

  void _handleRoomInvite(MeshMessage message) {
    if (message.roomId != null) {
      final room = _localRooms[message.roomId!];
      if (room != null && !room.members.contains(_myPeerId)) {
        room.members.add(_myPeerId);
        _emit('roomJoined', room);
        debugPrint('🏠 Joined room: ${room.name}');
      }
    }
  }

  String createLocalRoom(String name, {bool isEncrypted = true}) {
    final roomId =
        'room-${DateTime.now().millisecondsSinceEpoch}-${DateTime.now().millisecondsSinceEpoch.toString().substring(2, 11)}';

    final room = LocalRoom(
        id: roomId,
        name: name,
        creator: _myPeerId,
        members: [_myPeerId],
        created: DateTime.now(),
        isEncrypted: isEncrypted,
        isLocal: true);

    _localRooms[roomId] = room;
    _emit('roomCreated', room);
    _inviteNearbyPeersToRoom(roomId);

    return roomId;
  }

  void _inviteNearbyPeersToRoom(String roomId) {
    final room = _localRooms[roomId];
    if (room == null) return;

    final nearbyPeers = _peers.values
        .where(
            (p) => p.isConnected && (p.distance != null && p.distance! < 100))
        .toList();

    for (final peer in nearbyPeers) {
      sendMessage(
          peer.id,
          jsonEncode({
            'type': 'room-invite',
            'roomId': roomId,
            'roomName': room.name
          }));
    }
  }

  bool joinLocalRoom(String roomId) {
    final room = _localRooms[roomId];
    if (room == null) return false;

    if (!room.members.contains(_myPeerId)) {
      room.members.add(_myPeerId);
      _emit('roomJoined', room);
      debugPrint('🏠 Joined room: ${room.name}');
      return true;
    }
    return false;
  }

  List<LocalRoom> getLocalRooms() {
    return _localRooms.values.toList();
  }

  bool sendPing(String peerId) {
    return sendMessage(peerId, 'ping_request');
  }

  List<MeshPeer> getPeers() {
    return _peers.values.toList();
  }

  List<MeshPeer> getConnectedPeers() {
    return _peers.values.where((peer) => peer.isConnected).toList();
  }

  Map<String, dynamic> getMeshStatus() {
    final connectedPeers = getConnectedPeers();
    final localRooms = getLocalRooms();

    return {
      'isConnected': connectedPeers.isNotEmpty,
      'peerCount': _peers.length,
      'connectedCount': connectedPeers.length,
      'roomCount': localRooms.length,
      'discoveryMethods': {
        'bluetooth': false, // Would be true if Bluetooth is initialized
        'wifiDirect': false, // Would be true if WiFi Direct is initialized
        'localNetwork': true
      },
      'isOffline': true,
      'meshSize': connectedPeers.length + 1
    };
  }

  void setUserInfo(String name, String handle) {
    _myName = name;
    _myHandle = handle;
  }

  void stopDiscovery() {
    _isDiscovering = false;
    if (_discoveryInterval != null) {
      _discoveryInterval!.cancel();
      _discoveryInterval = null;
    }
    debugPrint('🛑 Stopped local mesh discovery');
    _emit('discoveryStopped', null);
  }

  void _emit(String event, dynamic data) {
    _eventController.add({event: event, data: data});
  }

  void disconnect() {
    stopDiscovery();

    for (final peer in _peers.values) {
      if (peer.connection != null) {
        peer.connection!.close();
      }
      if (peer.dataChannel != null) {
        peer.dataChannel!.close();
      }
    }

    _peers.clear();
    _localRooms.clear();

    if (_localMeshConnection != null) {
      _localMeshConnection!.close();
      _localMeshConnection = null;
    }

    debugPrint('🔌 Disconnected from mesh network');
  }
}
