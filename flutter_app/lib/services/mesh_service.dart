import 'dart:async';
import 'package:flutter/foundation.dart';
import 'package:flutter_webrtc/flutter_webrtc.dart';
import 'package:permission_handler/permission_handler.dart';
import 'package:geolocator/geolocator.dart';
import 'package:flutter_blue_plus/flutter_blue_plus.dart';
import 'package:connectivity_plus/connectivity_plus.dart';
import '../models/chat.dart';

class MeshService {
  static final MeshService _instance = MeshService._internal();
  factory MeshService() => _instance;
  MeshService._internal();

  RTCPeerConnection? _peerConnection;
  MediaStream? _localStream;
  final List<User> _discoveredPeers = [];
  final Map<String, RTCPeerConnection> _peerConnections = {};
  final Map<String, User> _connectedPeers = {};
  bool _isDiscovering = false;
  bool _isRealMode = false;
  String? _myPeerId;
  Position? _currentPosition;

  final StreamController<List<User>> _peersController =
      StreamController.broadcast();
  final StreamController<Map<String, dynamic>> _messageController =
      StreamController.broadcast();
  final StreamController<String> _connectionController =
      StreamController.broadcast();

  Stream<List<User>> get peersStream => _peersController.stream;
  Stream<Map<String, dynamic>> get messageStream => _messageController.stream;
  Stream<String> get connectionStream => _connectionController.stream;

  List<User> get discoveredPeers => List.unmodifiable(_discoveredPeers);
  Map<String, User> get connectedPeers => Map.unmodifiable(_connectedPeers);
  bool get isDiscovering => _isDiscovering;
  bool get isRealMode => _isRealMode;
  String? get myPeerId => _myPeerId;

  Future<void> initialize() async {
    await _requestPermissions();
    await _initializeWebRTC();
    await _getCurrentLocation();
    _myPeerId = _generatePeerId();

    if (kDebugMode) {
      print('MeshService initialized with peer ID: $_myPeerId');
    }
  }

  Future<void> _requestPermissions() async {
    await [
      Permission.bluetooth,
      Permission.bluetoothAdvertise,
      Permission.bluetoothConnect,
      Permission.bluetoothScan,
      Permission.location,
      Permission.nearbyWifiDevices,
    ].request();
  }

  Future<void> _initializeWebRTC() async {
    final configuration = <String, dynamic>{
      'iceServers': [
        {'urls': 'stun:stun.l.google.com:19302'},
        {'urls': 'stun:stun1.l.google.com:19302'},
      ]
    };

    _peerConnection = await createPeerConnection(configuration);

    _peerConnection!.onIceCandidate = (RTCIceCandidate candidate) {
      // Handle ICE candidates for peer connection
    };

    _peerConnection!.onTrack = (RTCTrackEvent event) {
      // Handle incoming media tracks
    };

    _peerConnection!.onConnectionState = (RTCPeerConnectionState state) {
      if (kDebugMode) {
        print('Peer connection state: $state');
      }
    };
  }

  Future<void> _getCurrentLocation() async {
    try {
      _currentPosition = await Geolocator.getCurrentPosition(
        desiredAccuracy: LocationAccuracy.high,
      );
    } catch (e) {
      if (kDebugMode) {
        print('Error getting location: $e');
      }
    }
  }

  String _generatePeerId() {
    return 'peer_${DateTime.now().millisecondsSinceEpoch}_${String.fromCharCodes(List.generate(8, (_) => DateTime.now().millisecondsSinceEpoch % 26 + 65))}';
  }

  Future<void> startDiscovery({bool realMode = false}) async {
    if (_isDiscovering) return;

    _isDiscovering = true;
    _isRealMode = realMode;

    if (realMode) {
      await _startRealDiscovery();
    } else {
      await _startSimulatedDiscovery();
    }

    _peersController.add(_discoveredPeers);
  }

  Future<void> _startRealDiscovery() async {
    try {
      // Bluetooth discovery using flutter_blue_plus
      if (await FlutterBluePlus.isSupported) {
        await FlutterBluePlus.startScan(timeout: const Duration(seconds: 30));
        FlutterBluePlus.scanResults.listen((results) {
          for (var result in results) {
            _addDiscoveredPeer(
              User(
                id: result.device.remoteId.str,
                handle: result.device.platformName.isNotEmpty
                    ? result.device.platformName
                    : 'Unknown',
                name: result.device.platformName.isNotEmpty
                    ? result.device.platformName
                    : 'Unknown Device',
                discoveryMethod: 'Bluetooth',
                signalStrength: result.rssi,
              ),
            );
          }
        });
      }

      // WiFi Direct discovery (simplified)
      await _discoverWiFiPeers();
    } catch (e) {
      if (kDebugMode) {
        print('Error in real discovery: $e');
      }
    }
  }

  Future<void> _startSimulatedDiscovery() async {
    // Simulate peer discovery for testing
    // Simulated users removed - only real peers will be discovered
  }

  Future<void> _discoverWiFiPeers() async {
    // Simplified WiFi peer discovery
    // In a real implementation, this would use WiFi Direct or similar
    final connectivity = await Connectivity().checkConnectivity();

    if (connectivity == ConnectivityResult.wifi) {
      // Add simulated WiFi peers for now
      final wifiPeer = User(
        id: 'wifi_peer_1',
        handle: 'wifi_user',
        name: 'WiFi Peer',
        discoveryMethod: 'WiFi Direct',
        signalStrength: 85,
        distance: 5.0,
      );

      _addDiscoveredPeer(wifiPeer);
    }
  }

  void _addDiscoveredPeer(User peer) {
    if (!_discoveredPeers.any((p) => p.id == peer.id)) {
      _discoveredPeers.add(peer);
      _peersController.add(_discoveredPeers);

      if (kDebugMode) {
        print('Discovered peer: ${peer.name} (${peer.discoveryMethod})');
      }
    }
  }

  Future<void> connectToPeer(String peerId) async {
    final peer = _discoveredPeers.firstWhere((p) => p.id == peerId);

    try {
      final pc = await createPeerConnection({
        'iceServers': [
          {'urls': 'stun:stun.l.google.com:19302'},
        ]
      });

      _peerConnections[peerId] = pc;

      // Create offer
      final offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      // In a real implementation, send this offer to the peer
      // For now, simulate connection
      await Future.delayed(const Duration(seconds: 2));

      _connectedPeers[peerId] = peer.copyWith(isConnected: true);
      _connectionController.add('connected:$peerId');

      if (kDebugMode) {
        print('Connected to peer: ${peer.name}');
      }
    } catch (e) {
      if (kDebugMode) {
        print('Error connecting to peer: $e');
      }
    }
  }

  Future<void> disconnectFromPeer(String peerId) async {
    final pc = _peerConnections[peerId];
    if (pc != null) {
      await pc.close();
      _peerConnections.remove(peerId);
    }

    _connectedPeers.remove(peerId);
    _connectionController.add('disconnected:$peerId');

    if (kDebugMode) {
      print('Disconnected from peer: $peerId');
    }
  }

  Future<void> sendMessage(String peerId, String message) async {
    final data = {
      'type': 'message',
      'from': _myPeerId,
      'to': peerId,
      'content': message,
      'timestamp': DateTime.now().toIso8601String(),
    };

    // Send via WebRTC data channel or other mesh protocol
    final pc = _peerConnections[peerId];
    if (pc != null) {
      // In a real implementation, send via data channel
      _messageController.add(data);
    }

    if (kDebugMode) {
      print('Sent message to $peerId: $message');
    }
  }

  Future<void> broadcastMessage(String message) async {
    for (final peerId in _connectedPeers.keys) {
      await sendMessage(peerId, message);
    }
  }

  void stopDiscovery() {
    _isDiscovering = false;
    FlutterBluePlus.stopScan();
    _discoveredPeers.clear();
    _peersController.add(_discoveredPeers);

    if (kDebugMode) {
      print('Stopped peer discovery');
    }
  }

  Future<void> dispose() async {
    stopDiscovery();

    for (final pc in _peerConnections.values) {
      await pc.close();
    }
    _peerConnections.clear();
    _connectedPeers.clear();

    await _peerConnection?.close();
    await _localStream?.dispose();

    await _peersController.close();
    await _messageController.close();
    await _connectionController.close();
  }

  List<User> getConnectedPeers() {
    return _connectedPeers.values.toList();
  }

  double? calculateDistance(String peerId) {
    final peer = _connectedPeers[peerId];
    return peer?.distance;
  }

  int? getSignalStrength(String peerId) {
    final peer = _connectedPeers[peerId];
    return peer?.signalStrength;
  }
}
