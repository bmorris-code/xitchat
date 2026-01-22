import 'dart:async';
import 'dart:convert';
import 'dart:io';
import 'dart:math' as math;
import 'package:flutter/foundation.dart';
import 'package:flutter_webrtc/flutter_webrtc.dart';
import 'package:flutter_blue_plus/flutter_blue_plus.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:permission_handler/permission_handler.dart';
import 'package:geolocator/geolocator.dart';
import 'models.dart';

class EnhancedP2PService {
  final Map<String, MeshPeer> _peers = {};
  final Map<String, LocalRoom> _localRooms = {};
  late String _myPeerId;
  late String _myName;
  late String _myHandle;
  final StreamController<Map<String, dynamic>> _eventController =
      StreamController.broadcast();

  // Discovery and connection management
  Timer? _discoveryInterval;
  Timer? _heartbeatInterval;
  bool _isDiscovering = false;
  bool _isBluetoothEnabled = false;
  bool _isWifiDirectEnabled = false;

  // Bluetooth specific
  BluetoothDevice? _bluetoothDevice;
  BluetoothCharacteristic? _meshCharacteristic;
  StreamSubscription<List<ScanResult>>? _scanSubscription;

  // WiFi Direct specific (platform-dependent)
  // Note: WiFi Direct requires native implementation via platform channels
  // See WIFI_DIRECT_IMPLEMENTATION_PLAN.md for implementation details
  dynamic _wifiDirect; // Will be implemented via platform channels

  // WebRTC connections
  final Map<String, RTCPeerConnection> _peerConnections = {};
  final Map<String, RTCDataChannel> _dataChannels = {};

  // Location for proximity detection
  Position? _currentLocation;

  Stream<Map<String, dynamic>> get events => _eventController.stream;

  EnhancedP2PService() {
    _myPeerId = _generatePeerId();
    _myName = 'XitChat ${_myPeerId.substring(5, 9)}';
    _myHandle = '@xitchat${_myPeerId.substring(5, 9)}';
  }

  String get myPeerId => _myPeerId;
  String get myName => _myName;
  String get myHandle => _myHandle;

  String _generatePeerId() {
    final timestamp = DateTime.now().millisecondsSinceEpoch.toString();
    final random = (DateTime.now().millisecondsSinceEpoch % 10000).toString();
    return 'xitchat-$timestamp-$random';
  }

  Future<bool> initialize() async {
    try {
      debugPrint('🔧 Initializing Enhanced P2P Service...');

      // Request permissions
      await _requestPermissions();

      // Initialize Bluetooth
      await _initializeBluetooth();

      // Initialize WiFi Direct
      await _initializeWiFiDirect();

      // Get current location for proximity
      await _getCurrentLocation();

      // Start WebRTC signaling
      await _startWebRTCSignaling();

      // Start heartbeat
      _startHeartbeat();

      debugPrint('✅ Enhanced P2P Service initialized - ID: $_myPeerId');
      return true;
    } catch (error) {
      debugPrint('❌ Enhanced P2P initialization failed: $error');
      return false;
    }
  }

  Future<void> _requestPermissions() async {
    final permissions = [
      Permission.bluetooth,
      Permission.bluetoothAdvertise,
      Permission.bluetoothScan,
      Permission.bluetoothConnect,
      Permission.location,
      Permission.nearbyWifiDevices,
    ];

    for (final permission in permissions) {
      final status = await permission.request();
      debugPrint('📋 Permission ${permission.toString()}: $status');
    }
  }

  Future<void> _initializeBluetooth() async {
    try {
      // Check if Bluetooth is available
      if (await FlutterBluePlus.isSupported == false) {
        debugPrint('⚠️ Bluetooth not supported on this device');
        return;
      }

      // Check if Bluetooth is enabled
      if (await FlutterBluePlus.isOn == false) {
        debugPrint('⚠️ Bluetooth is not enabled');
        // Request user to enable Bluetooth
        await FlutterBluePlus.startScan(timeout: const Duration(seconds: 1));
        return;
      }

      _isBluetoothEnabled = true;
      debugPrint('✅ Bluetooth initialized');

      // Set up XitChat GATT service
      await _setupBluetoothService();
    } catch (error) {
      debugPrint('❌ Bluetooth initialization failed: $error');
    }
  }

  Future<void> _setupBluetoothService() async {
    try {
      // Note: flutter_blue_plus doesn't have startAdvertising method
      // We'll focus on scanning for other devices instead
      debugPrint('📡 Setting up XitChat Bluetooth service (scanning mode)');
      
      // Start scanning for other XitChat devices
      _scanSubscription = FlutterBluePlus.scanResults.listen((results) {
        for (final result in results) {
          _handleBluetoothDeviceDiscovered(result);
        }
      });
      
      await FlutterBluePlus.startScan(timeout: const Duration(seconds: 30));
      
      debugPrint('📡 Started scanning for XitChat devices');
    } catch (error) {
      debugPrint('❌ Failed to setup Bluetooth service: $error');
    }
  }

  void _handleBluetoothDeviceDiscovered(ScanResult result) {
    final device = result.device;
    final name = device.name;

    // Only connect to XitChat devices
    if (name.contains('XitChat') && device.id != _myPeerId) {
      debugPrint('🔍 Found XitChat device: $name');

      final peer = MeshPeer(
        id: device.id.toString(),
        name: name,
        handle: '@${name.toLowerCase().replaceAll(' ', '')}',
        discoveryMethod: 'bluetooth',
        signalStrength: result.rssi,
        distance: _calculateDistanceFromRSSI(result.rssi),
      );

      if (!_peers.containsKey(peer.id)) {
        _peers[peer.id] = peer;
        _emit('peerDiscovered', peer);
        _connectToBluetoothDevice(device);
      }
    }
  }

  double _calculateDistanceFromRSSI(int rssi) {
    // Simple RSSI to distance calculation
    // This is approximate and should be calibrated
    if (rssi >= -50) return 1.0;
    if (rssi >= -60) return 3.0;
    if (rssi >= -70) return 5.0;
    if (rssi >= -80) return 10.0;
    return 15.0;
  }

  Future<void> _connectToBluetoothDevice(BluetoothDevice device) async {
    try {
      await device.connect();

      // Discover services
      List<BluetoothService> services = await device.discoverServices();

      for (BluetoothService service in services) {
        if (service.uuid.toString() == '12345678-1234-1234-1234-123456789abc') {
          // Found XitChat service
          for (BluetoothCharacteristic characteristic
              in service.characteristics) {
            if (characteristic.uuid.toString() ==
                '12345678-1234-1234-1234-123456789abd') {
              _meshCharacteristic = characteristic;

              // Subscribe to notifications
              await characteristic.setNotifyValue(true);
              characteristic.value.listen((value) {
                _handleBluetoothMessage(value);
              });

              debugPrint('🔗 Connected to XitChat mesh service');
              _emit('bluetoothConnected', {'deviceId': device.id.toString()});
            }
          }
        }
      }
    } catch (error) {
      debugPrint('❌ Failed to connect to Bluetooth device: $error');
    }
  }

  void _handleBluetoothMessage(List<int> value) {
    try {
      final message = utf8.decode(value);
      final data = jsonDecode(message);

      if (data['type'] == 'mesh_message') {
        _handleMeshMessage(data);
      } else if (data['type'] == 'peer_announcement') {
        _handlePeerAnnouncement(data);
      }
    } catch (error) {
      debugPrint('❌ Failed to parse Bluetooth message: $error');
    }
  }

  Future<void> _initializeWiFiDirect() async {
    try {
      if (Platform.isAndroid) {
        // WiFi Direct requires native Android implementation
        // See flutter_app/WIFI_DIRECT_IMPLEMENTATION_PLAN.md for details

        // TODO: Implement WiFi Direct via platform channels
        // For now, we'll use WebRTC as the primary local network protocol

        debugPrint(
            '⚠️ WiFi Direct not yet implemented - using WebRTC for local P2P');
        debugPrint(
            '📖 See WIFI_DIRECT_IMPLEMENTATION_PLAN.md for implementation guide');

        _isWifiDirectEnabled = false;
      } else if (Platform.isIOS) {
        // iOS doesn't support WiFi Direct - use Multipeer Connectivity instead
        // TODO: Implement Multipeer Connectivity via platform channels

        debugPrint('⚠️ iOS uses Multipeer Connectivity instead of WiFi Direct');
        debugPrint(
            '📖 See WIFI_DIRECT_IMPLEMENTATION_PLAN.md for implementation guide');

        _isWifiDirectEnabled = false;
      } else {
        debugPrint('⚠️ WiFi Direct not available on this platform');
        _isWifiDirectEnabled = false;
      }
    } catch (error) {
      debugPrint('❌ WiFi Direct initialization failed: $error');
      _isWifiDirectEnabled = false;
    }
  }

  void _handleWiFiDirectPeer(dynamic peer) {
    // Handle WiFi Direct peer discovery
    debugPrint('🔍 Found WiFi Direct peer: ${peer.deviceName}');

    final meshPeer = MeshPeer(
      id: peer.deviceAddress,
      name: peer.deviceName,
      handle: '@${peer.deviceName.toLowerCase().replaceAll(' ', '')}',
      discoveryMethod: 'wifi-direct',
      signalStrength: peer.signalStrength ?? 80,
      distance: 5.0,
    );

    if (!_peers.containsKey(meshPeer.id)) {
      _peers[meshPeer.id] = meshPeer;
      _emit('peerDiscovered', meshPeer);
    }
  }

  Future<void> _getCurrentLocation() async {
    try {
      final position = await Geolocator.getCurrentPosition(
        desiredAccuracy: LocationAccuracy.high,
      );
      _currentLocation = position;
      debugPrint(
          '📍 Current location: ${position.latitude}, ${position.longitude}');
    } catch (error) {
      debugPrint('⚠️ Could not get location: $error');
    }
  }

  Future<void> _startWebRTCSignaling() async {
    // Start WebRTC signaling via SharedPreferences for cross-platform communication
    _discoveryInterval = Timer.periodic(const Duration(seconds: 5), (timer) {
      _broadcastWebRTCOffer();
    });

    // Listen for WebRTC signals
    Timer.periodic(const Duration(seconds: 2), (timer) {
      _checkForWebRTCSignals();
    });
  }

  Future<void> _broadcastWebRTCOffer() async {
    final prefs = await SharedPreferences.getInstance();

    // Create WebRTC offer
    final pc = await createPeerConnection({'iceServers': []});
    final offer = await pc.createOffer();
    await pc.setLocalDescription(offer);

    final offerData = {
      'type': 'webrtc-offer',
      'peerId': _myPeerId,
      'name': _myName,
      'handle': _myHandle,
      'offer': {
        'sdp': offer.sdp,
        'type': offer.type,
      },
      'timestamp': DateTime.now().millisecondsSinceEpoch,
      'location': _currentLocation != null
          ? {
              'lat': _currentLocation!.latitude,
              'lng': _currentLocation!.longitude,
            }
          : null,
    };

    await prefs.setString(
        'xitchat-webrtc-offer-$_myPeerId', jsonEncode(offerData));
  }

  Future<void> _checkForWebRTCSignals() async {
    final prefs = await SharedPreferences.getInstance();
    final keys = prefs.getKeys();

    for (final key in keys) {
      if (key.startsWith('xitchat-webrtc-offer-') && !key.contains(_myPeerId)) {
        try {
          final offerData = jsonDecode(prefs.getString(key) ?? '{}');

          // Check if offer is recent (within 30 seconds)
          if (DateTime.now().millisecondsSinceEpoch - offerData['timestamp'] <
              30000) {
            await _handleWebRTCOffer(offerData);
            await prefs.remove(key);
          }
        } catch (error) {
          debugPrint('❌ Failed to parse WebRTC offer: $error');
        }
      }
    }
  }

  Future<void> _handleWebRTCOffer(Map<String, dynamic> offerData) async {
    final peerId = offerData['peerId'];

    if (_peers.containsKey(peerId)) return;

    debugPrint('🤝 Received WebRTC offer from: ${offerData['name']}');

    // Create peer object
    final peer = MeshPeer(
      id: peerId,
      name: offerData['name'],
      handle: offerData['handle'],
      discoveryMethod: 'local-network',
      signalStrength: 85,
      distance: _calculateDistance(
        _currentLocation?.latitude,
        _currentLocation?.longitude,
        offerData['location']?['lat'],
        offerData['location']?['lng'],
      ),
    );

    _peers[peerId] = peer;
    _emit('peerDiscovered', peer);

    // Create WebRTC connection
    await _createWebRTCConnection(peerId, offerData['offer']);
  }

  double _calculateDistance(
      double? lat1, double? lng1, double? lat2, double? lng2) {
    if (lat1 == null || lng1 == null || lat2 == null || lng2 == null) {
      return 10.0; // Default distance
    }

    // Calculate distance using Haversine formula
    const double earthRadius = 6371000; // Earth's radius in meters

    final double dLat = (lat2 - lat1) * (math.pi / 180);
    final double dLng = (lng2 - lng1) * (math.pi / 180);

    final double a = math.sin(dLat / 2) * math.sin(dLat / 2) +
        math.cos(lat1 * math.pi / 180) *
            math.cos(lat2 * math.pi / 180) *
            math.sin(dLng / 2) *
            math.sin(dLng / 2);

    final double c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a));

    return earthRadius * c; // Distance in meters
  }

  Future<void> _createWebRTCConnection(
      String peerId, Map<String, dynamic> offerData) async {
    try {
      final pc = await createPeerConnection({
        'iceServers': [
          {'urls': 'stun:stun.l.google.com:19302'},
        ]
      });

      _peerConnections[peerId] = pc;

      // Handle ICE candidates
      pc.onIceCandidate = (RTCIceCandidate candidate) {
        _sendIceCandidate(peerId, candidate);
      };

      // Handle data channels
      pc.onDataChannel = (RTCDataChannel channel) {
        _setupDataChannel(channel, peerId);
      };

      // Set remote description
      await pc.setRemoteDescription(RTCSessionDescription(
        offerData['sdp'],
        offerData['type'],
      ));

      // Create answer
      final answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      // Send answer via SharedPreferences
      await _sendWebRTCAnswer(peerId, answer);
    } catch (error) {
      debugPrint('❌ Failed to create WebRTC connection: $error');
    }
  }

  Future<void> _sendWebRTCAnswer(
      String peerId, RTCSessionDescription answer) async {
    final prefs = await SharedPreferences.getInstance();

    final answerData = {
      'type': 'webrtc-answer',
      'from': _myPeerId,
      'to': peerId,
      'answer': {
        'sdp': answer.sdp,
        'type': answer.type,
      },
      'timestamp': DateTime.now().millisecondsSinceEpoch,
    };

    await prefs.setString(
        'xitchat-webrtc-answer-$_myPeerId-$peerId', jsonEncode(answerData));
  }

  Future<void> _sendIceCandidate(
      String peerId, RTCIceCandidate candidate) async {
    final prefs = await SharedPreferences.getInstance();

    final candidateData = {
      'type': 'webrtc-ice',
      'from': _myPeerId,
      'to': peerId,
      'candidate': {
        'candidate': candidate.candidate,
        'sdpMid': candidate.sdpMid,
        'sdpMLineIndex': candidate.sdpMLineIndex,
      },
      'timestamp': DateTime.now().millisecondsSinceEpoch,
    };

    await prefs.setString(
        'xitchat-webrtc-ice-$_myPeerId-$peerId-${DateTime.now().millisecondsSinceEpoch}',
        jsonEncode(candidateData));
  }

  void _setupDataChannel(RTCDataChannel channel, String peerId) {
    _dataChannels[peerId] = channel;

    channel.onMessage = (RTCDataChannelMessage message) {
      try {
        final data = jsonDecode(message.text);
        _handleDataChannelMessage(peerId, data);
      } catch (error) {
        debugPrint('❌ Failed to parse data channel message: $error');
      }
    };

    channel.stateChangeStream.listen((state) {
      if (state == RTCDataChannelState.RTCDataChannelOpen) {
        debugPrint('💬 Data channel open with $peerId');
        _peers[peerId]?.isConnected = true;
        _emit('peerConnected', _peers[peerId]);
      } else if (state == RTCDataChannelState.RTCDataChannelClosed) {
        debugPrint('💬 Data channel closed with $peerId');
        _peers[peerId]?.isConnected = false;
        _emit('peerDisconnected', _peers[peerId]);
      }
    });
  }

  void _handleDataChannelMessage(String peerId, Map<String, dynamic> data) {
    switch (data['type']) {
      case 'chat':
        _emit('messageReceived', {
          'from': peerId,
          'content': data['content'],
          'timestamp': data['timestamp'],
        });
        break;
      case 'ping':
        _sendPong(peerId);
        break;
      case 'room_invite':
        _handleRoomInvite(peerId, data);
        break;
    }
  }

  void _handleMeshMessage(Map<String, dynamic> data) {
    // Handle Bluetooth mesh messages
    _emit('messageReceived', data);
  }

  void _handlePeerAnnouncement(Map<String, dynamic> data) {
    // Handle peer announcements via Bluetooth
    final peerId = data['peerId'];

    if (!_peers.containsKey(peerId)) {
      final peer = MeshPeer(
        id: peerId,
        name: data['name'],
        handle: data['handle'],
        discoveryMethod: 'bluetooth',
        signalStrength: data['signalStrength'] ?? 80,
        distance: data['distance'] ?? 5.0,
      );

      _peers[peerId] = peer;
      _emit('peerDiscovered', peer);
    }
  }

  void _handleRoomInvite(String peerId, Map<String, dynamic> data) {
    final roomId = data['roomId'];
    if (roomId != null) {
      final room = _localRooms[roomId];
      if (room != null && !room.members.contains(_myPeerId)) {
        room.members.add(_myPeerId);
        _emit('roomJoined', room);
      }
    }
  }

  void _sendPong(String peerId) {
    final channel = _dataChannels[peerId];
    if (channel != null &&
        channel.state == RTCDataChannelState.RTCDataChannelOpen) {
      channel.send(RTCDataChannelMessage(jsonEncode({
        'type': 'pong',
        'from': _myPeerId,
        'timestamp': DateTime.now().millisecondsSinceEpoch,
      })));
    }
  }

  void _startHeartbeat() {
    _heartbeatInterval = Timer.periodic(const Duration(seconds: 30), (timer) {
      _sendHeartbeat();
    });
  }

  void _sendHeartbeat() {
    final announcement = {
      'type': 'peer_announcement',
      'peerId': _myPeerId,
      'name': _myName,
      'handle': _myHandle,
      'timestamp': DateTime.now().millisecondsSinceEpoch,
    };

    // Send via Bluetooth if available
    if (_meshCharacteristic != null) {
      _meshCharacteristic!.write(utf8.encode(jsonEncode(announcement)));
    }

    // Send via WebRTC data channels
    for (final channel in _dataChannels.values) {
      if (channel.state == RTCDataChannelState.RTCDataChannelOpen) {
        channel.send(RTCDataChannelMessage(jsonEncode(announcement)));
      }
    }
  }

  // Public API
  Future<void> startDiscovery() async {
    if (_isDiscovering) return;

    debugPrint('🔍 Starting enhanced discovery...');
    _isDiscovering = true;

    // Start Bluetooth scanning
    if (_isBluetoothEnabled) {
      await FlutterBluePlus.startScan(timeout: const Duration(seconds: 30));
    }

    // WiFi Direct discovery (not yet implemented)
    // When implemented, this will start WiFi Direct peer discovery
    // For now, WebRTC handles local network P2P

    _emit('discoveryStarted');
  }

  void stopDiscovery() {
    if (_discoveryInterval != null) {
      _discoveryInterval!.cancel();
      _discoveryInterval = null;
    }

    if (_heartbeatInterval != null) {
      _heartbeatInterval!.cancel();
      _heartbeatInterval = null;
    }

    if (_scanSubscription != null) {
      _scanSubscription!.cancel();
      _scanSubscription = null;
    }

    FlutterBluePlus.stopScan();

    _isDiscovering = false;
    debugPrint('🛑 Stopped discovery');
    _emit('discoveryStopped');
  }

  bool sendMessage(String peerId, String content) {
    // Try WebRTC first
    final channel = _dataChannels[peerId];
    if (channel != null &&
        channel.state == RTCDataChannelState.RTCDataChannelOpen) {
      try {
        channel.send(RTCDataChannelMessage(jsonEncode({
          'type': 'chat',
          'content': content,
          'from': _myPeerId,
          'timestamp': DateTime.now().millisecondsSinceEpoch,
        })));
        _emit('messageSent', {'to': peerId, 'content': content});
        return true;
      } catch (error) {
        debugPrint('❌ Failed to send WebRTC message: $error');
      }
    }

    // Fallback to Bluetooth
    if (_meshCharacteristic != null) {
      try {
        final message = {
          'type': 'mesh_message',
          'from': _myPeerId,
          'to': peerId,
          'content': content,
          'timestamp': DateTime.now().millisecondsSinceEpoch,
        };
        _meshCharacteristic!.write(utf8.encode(jsonEncode(message)));
        _emit('messageSent', {'to': peerId, 'content': content});
        return true;
      } catch (error) {
        debugPrint('❌ Failed to send Bluetooth message: $error');
      }
    }

    return false;
  }

  String createLocalRoom(String name, {String? description}) {
    final roomId =
        'room-${DateTime.now().millisecondsSinceEpoch}-${_myPeerId.substring(5, 9)}';

    final room = LocalRoom(
      id: roomId,
      name: name,
      creator: _myPeerId,
      members: [_myPeerId],
      created: DateTime.now(),
      isEncrypted: true,
      isLocal: true,
      description: description,
    );

    _localRooms[roomId] = room;
    _emit('roomCreated', room);

    // Invite nearby peers
    _inviteNearbyPeers(roomId);

    return roomId;
  }

  void _inviteNearbyPeers(String roomId) {
    final room = _localRooms[roomId];
    if (room == null) return;

    final nearbyPeers = _peers.values.where((p) => p.isConnected).toList();

    for (final peer in nearbyPeers) {
      sendMessage(
          peer.id,
          jsonEncode({
            'type': 'room_invite',
            'roomId': roomId,
            'roomName': room.name,
          }));
    }
  }

  bool joinLocalRoom(String roomId) {
    final room = _localRooms[roomId];
    if (room == null) return false;

    if (!room.members.contains(_myPeerId)) {
      room.members.add(_myPeerId);
      _emit('roomJoined', room);
      return true;
    }
    return false;
  }

  // Getters
  List<MeshPeer> getPeers() => _peers.values.toList();
  List<MeshPeer> getConnectedPeers() =>
      _peers.values.where((p) => p.isConnected).toList();
  List<LocalRoom> getLocalRooms() => _localRooms.values.toList();

  Map<String, dynamic> getMeshStatus() {
    final connectedPeers = getConnectedPeers();

    return {
      'isConnected': connectedPeers.isNotEmpty,
      'peerCount': _peers.length,
      'connectedCount': connectedPeers.length,
      'roomCount': _localRooms.length,
      'discoveryMethods': {
        'bluetooth': _isBluetoothEnabled,
        'wifiDirect': _isWifiDirectEnabled,
        'localNetwork': true,
      },
      'isOffline': true,
      'meshSize': connectedPeers.length + 1,
      'myPeerId': _myPeerId,
      'location': _currentLocation != null
          ? {
              'lat': _currentLocation!.latitude,
              'lng': _currentLocation!.longitude,
            }
          : null,
    };
  }

  void _emit(String event, [dynamic data]) {
    _eventController.add({event: data ?? {}});
  }

  void disconnect() {
    stopDiscovery();

    // Close WebRTC connections
    for (final pc in _peerConnections.values) {
      pc.close();
    }
    _peerConnections.clear();

    // Close data channels
    for (final channel in _dataChannels.values) {
      channel.close();
    }
    _dataChannels.clear();

    // Disconnect Bluetooth
    for (final peer in _peers.values) {
      if (peer.bluetoothDevice != null) {
        peer.bluetoothDevice!.disconnect();
      }
    }

    _peers.clear();
    _localRooms.clear();

    debugPrint('🔌 Disconnected from mesh network');
    _emit('disconnected', null);
  }
}
