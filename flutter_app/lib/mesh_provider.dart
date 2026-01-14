import 'package:flutter/material.dart';
import 'models.dart';
import 'p2p_service.dart';

class MeshProvider with ChangeNotifier {
  final FlutterP2PService _p2pService = FlutterP2PService();
  final List<MeshPeer> _peers = [];
  final List<LocalRoom> _rooms = [];
  bool _isRealMode = false;
  final bool _isDiscovering = false;

  List<MeshPeer> get peers => _peers;
  List<LocalRoom> get rooms => _rooms;
  bool get isRealMode => _isRealMode;
  bool get isDiscovering => _isDiscovering;

  FlutterP2PService get p2pService => _p2pService;

  MeshProvider() {
    _initializeService();
  }

  Future<void> _initializeService() async {
    await _p2pService.initialize();

    // Listen to P2P events
    _p2pService.events.listen((event) {
      switch (event['event']) {
        case 'peerDiscovered':
          final peer = event['data'] as MeshPeer;
          _addPeer(peer);
          break;
        case 'peerConnected':
          final peer = event['data'] as MeshPeer;
          _updatePeerStatus(peer.id, true);
          break;
        case 'peerDisconnected':
          final peer = event['data'] as MeshPeer;
          _updatePeerStatus(peer.id, false);
          break;
        case 'messageReceived':
          // Handle incoming messages
          break;
        case 'roomCreated':
          final room = event['data'] as LocalRoom;
          _addRoom(room);
          break;
        case 'roomJoined':
          final room = event['data'] as LocalRoom;
          _updateRoom(room);
          break;
      }
    });
  }

  void toggleMode() {
    _isRealMode = !_isRealMode;
    notifyListeners();

    if (_isRealMode) {
      _p2pService.startDiscovery();
    } else {
      _p2pService.stopDiscovery();
    }
  }

  void _addPeer(MeshPeer peer) {
    if (!_peers.any((p) => p.id == peer.id)) {
      _peers.add(peer);
      notifyListeners();
    }
  }

  void _updatePeerStatus(String peerId, bool isConnected) {
    final index = _peers.indexWhere((p) => p.id == peerId);
    if (index != -1) {
      _peers[index].isConnected = isConnected;
      notifyListeners();
    }
  }

  void _addRoom(LocalRoom room) {
    if (!_rooms.any((r) => r.id == room.id)) {
      _rooms.add(room);
      notifyListeners();
    }
  }

  void _updateRoom(LocalRoom room) {
    final index = _rooms.indexWhere((r) => r.id == room.id);
    if (index != -1) {
      _rooms[index] = room;
      notifyListeners();
    }
  }

  List<MeshPeer> getConnectedPeers() {
    return _p2pService.getConnectedPeers();
  }

  Future<void> connectToPeer(String peerId) async {
    // Trigger discovery which will attempt to connect to peers
    _p2pService.startDiscovery();
  }

  bool sendMessage(String peerId, String content) {
    return _p2pService.sendMessage(peerId, content);
  }

  String createRoom(String name, {bool isEncrypted = true}) {
    return _p2pService.createLocalRoom(name, isEncrypted: isEncrypted);
  }

  bool joinRoom(String roomId) {
    return _p2pService.joinLocalRoom(roomId);
  }
}
