import 'package:flutter_webrtc/flutter_webrtc.dart';
import 'package:flutter_blue_plus/flutter_blue_plus.dart';

class MeshPeer {
  final String id;
  final String name;
  final String handle;
  RTCPeerConnection? connection;
  RTCDataChannel? dataChannel;
  BluetoothDevice? bluetoothDevice; // For Bluetooth connections
  bool isConnected = false;
  DateTime lastSeen;
  String discoveryMethod;
  int? signalStrength;
  double? distance;

  MeshPeer({
    required this.id,
    required this.name,
    required this.handle,
    required this.discoveryMethod,
    DateTime? lastSeen,
    this.signalStrength,
    this.distance,
    this.bluetoothDevice,
  }) : lastSeen = lastSeen ?? DateTime.now();
}

class MeshMessage {
  final String id;
  final String from;
  final String to;
  final String content;
  final DateTime timestamp;
  final String type; // 'chat' | 'ping' | 'discovery' | 'room-invite'
  final String? roomId;
  final List<String>? route; // Path of peer IDs for mesh routing

  MeshMessage({
    required this.id,
    required this.from,
    required this.to,
    required this.content,
    required this.timestamp,
    required this.type,
    this.roomId,
    this.route,
  });
}

class LocalRoom {
  final String id;
  final String name;
  final String creator;
  final List<String> members;
  final DateTime created;
  final bool isEncrypted;
  final bool isLocal;
  final String? description;

  LocalRoom({
    required this.id,
    required this.name,
    required this.creator,
    required this.members,
    required this.created,
    required this.isEncrypted,
    required this.isLocal,
    this.description,
  });
}
