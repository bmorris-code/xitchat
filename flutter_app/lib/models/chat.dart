class Chat {
  final String id;
  final String name;
  final String lastMessage;
  final DateTime lastMessageTime;
  final bool isOnline;
  final bool isGroup;
  final List<String> participants;
  final String? avatar;
  final int unreadCount;
  final bool isEncrypted;
  final bool isMeshEnabled;

  Chat({
    required this.id,
    required this.name,
    required this.lastMessage,
    required this.lastMessageTime,
    this.isOnline = false,
    this.isGroup = false,
    this.participants = const [],
    this.avatar,
    this.unreadCount = 0,
    this.isEncrypted = false,
    this.isMeshEnabled = false,
  });

  factory Chat.fromJson(Map<String, dynamic> json) {
    return Chat(
      id: json['id'] ?? '',
      name: json['name'] ?? '',
      lastMessage: json['lastMessage'] ?? '',
      lastMessageTime: DateTime.parse(json['lastMessageTime'] ?? DateTime.now().toIso8601String()),
      isOnline: json['isOnline'] ?? false,
      isGroup: json['isGroup'] ?? false,
      participants: List<String>.from(json['participants'] ?? []),
      avatar: json['avatar'],
      unreadCount: json['unreadCount'] ?? 0,
      isEncrypted: json['isEncrypted'] ?? false,
      isMeshEnabled: json['isMeshEnabled'] ?? false,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'name': name,
      'lastMessage': lastMessage,
      'lastMessageTime': lastMessageTime.toIso8601String(),
      'isOnline': isOnline,
      'isGroup': isGroup,
      'participants': participants,
      'avatar': avatar,
      'unreadCount': unreadCount,
      'isEncrypted': isEncrypted,
      'isMeshEnabled': isMeshEnabled,
    };
  }

  Chat copyWith({
    String? id,
    String? name,
    String? lastMessage,
    DateTime? lastMessageTime,
    bool? isOnline,
    bool? isGroup,
    List<String>? participants,
    String? avatar,
    int? unreadCount,
    bool? isEncrypted,
    bool? isMeshEnabled,
  }) {
    return Chat(
      id: id ?? this.id,
      name: name ?? this.name,
      lastMessage: lastMessage ?? this.lastMessage,
      lastMessageTime: lastMessageTime ?? this.lastMessageTime,
      isOnline: isOnline ?? this.isOnline,
      isGroup: isGroup ?? this.isGroup,
      participants: participants ?? this.participants,
      avatar: avatar ?? this.avatar,
      unreadCount: unreadCount ?? this.unreadCount,
      isEncrypted: isEncrypted ?? this.isEncrypted,
      isMeshEnabled: isMeshEnabled ?? this.isMeshEnabled,
    );
  }
}

class Message {
  final String id;
  final String chatId;
  final String senderId;
  final String content;
  final DateTime timestamp;
  final bool isMe;
  final String? attachmentUrl;
  final String? attachmentType;
  final List<Reaction> reactions;
  final bool isEncrypted;
  final bool isDelivered;
  final bool isRead;
  final ReplyTo? replyTo;

  Message({
    required this.id,
    required this.chatId,
    required this.senderId,
    required this.content,
    required this.timestamp,
    this.isMe = false,
    this.attachmentUrl,
    this.attachmentType,
    this.reactions = const [],
    this.isEncrypted = false,
    this.isDelivered = false,
    this.isRead = false,
    this.replyTo,
  });

  factory Message.fromJson(Map<String, dynamic> json) {
    return Message(
      id: json['id'] ?? '',
      chatId: json['chatId'] ?? '',
      senderId: json['senderId'] ?? '',
      content: json['content'] ?? '',
      timestamp: DateTime.parse(json['timestamp'] ?? DateTime.now().toIso8601String()),
      isMe: json['isMe'] ?? false,
      attachmentUrl: json['attachmentUrl'],
      attachmentType: json['attachmentType'],
      reactions: (json['reactions'] as List<dynamic>?)
          ?.map((r) => Reaction.fromJson(r))
          .toList() ?? [],
      isEncrypted: json['isEncrypted'] ?? false,
      isDelivered: json['isDelivered'] ?? false,
      isRead: json['isRead'] ?? false,
      replyTo: json['replyTo'] != null ? ReplyTo.fromJson(json['replyTo']) : null,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'chatId': chatId,
      'senderId': senderId,
      'content': content,
      'timestamp': timestamp.toIso8601String(),
      'isMe': isMe,
      'attachmentUrl': attachmentUrl,
      'attachmentType': attachmentType,
      'reactions': reactions.map((r) => r.toJson()).toList(),
      'isEncrypted': isEncrypted,
      'isDelivered': isDelivered,
      'isRead': isRead,
      'replyTo': replyTo?.toJson(),
    };
  }
}

class Reaction {
  final String emoji;
  final String userId;
  final DateTime timestamp;

  Reaction({
    required this.emoji,
    required this.userId,
    required this.timestamp,
  });

  factory Reaction.fromJson(Map<String, dynamic> json) {
    return Reaction(
      emoji: json['emoji'] ?? '',
      userId: json['userId'] ?? '',
      timestamp: DateTime.parse(json['timestamp'] ?? DateTime.now().toIso8601String()),
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'emoji': emoji,
      'userId': userId,
      'timestamp': timestamp.toIso8601String(),
    };
  }
}

class ReplyTo {
  final String id;
  final String senderHandle;
  final String text;

  ReplyTo({
    required this.id,
    required this.senderHandle,
    required this.text,
  });

  factory ReplyTo.fromJson(Map<String, dynamic> json) {
    return ReplyTo(
      id: json['id'] ?? '',
      senderHandle: json['senderHandle'] ?? '',
      text: json['text'] ?? '',
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'senderHandle': senderHandle,
      'text': text,
    };
  }
}

enum PeerType {
  bluetooth,
  wifi,
  real, mesh,
}

class User {
  final String id;
  final String handle;
  final String name;
  final String? avatar;
  final bool isOnline;
  final bool isConnected;
  final String? discoveryMethod;
  final int? signalStrength;
  final double? distance;
  final DateTime? lastSeen;
  final Map<String, dynamic> metadata;
  final PeerType peerType;

  User({
    required this.id,
    required this.handle,
    required this.name,
    this.avatar,
    this.isOnline = false,
    this.isConnected = false,
    this.discoveryMethod,
    this.signalStrength,
    this.distance,
    this.lastSeen,
    this.metadata = const {},
    this.peerType = PeerType.bluetooth,
  });

  factory User.fromJson(Map<String, dynamic> json) {
    return User(
      id: json['id'] ?? '',
      handle: json['handle'] ?? '',
      name: json['name'] ?? '',
      avatar: json['avatar'],
      isOnline: json['isOnline'] ?? false,
      isConnected: json['isConnected'] ?? false,
      discoveryMethod: json['discoveryMethod'],
      signalStrength: json['signalStrength'],
      distance: json['distance']?.toDouble(),
      lastSeen: json['lastSeen'] != null 
          ? DateTime.parse(json['lastSeen']) 
          : null,
      metadata: Map<String, dynamic>.from(json['metadata'] ?? {}),
      peerType: PeerType.values.firstWhere(
        (e) => e.name == json['peerType'],
        orElse: () => PeerType.bluetooth,
      ),
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'handle': handle,
      'name': name,
      'avatar': avatar,
      'isOnline': isOnline,
      'isConnected': isConnected,
      'discoveryMethod': discoveryMethod,
      'signalStrength': signalStrength,
      'distance': distance,
      'lastSeen': lastSeen?.toIso8601String(),
      'metadata': metadata,
      'peerType': peerType.name,
    };
  }

  User copyWith({
    String? id,
    String? handle,
    String? name,
    String? avatar,
    bool? isOnline,
    bool? isConnected,
    String? discoveryMethod,
    int? signalStrength,
    double? distance,
    DateTime? lastSeen,
    Map<String, dynamic>? metadata,
    PeerType? peerType,
  }) {
    return User(
      id: id ?? this.id,
      handle: handle ?? this.handle,
      name: name ?? this.name,
      avatar: avatar ?? this.avatar,
      isOnline: isOnline ?? this.isOnline,
      isConnected: isConnected ?? this.isConnected,
      discoveryMethod: discoveryMethod ?? this.discoveryMethod,
      signalStrength: signalStrength ?? this.signalStrength,
      distance: distance ?? this.distance,
      lastSeen: lastSeen ?? this.lastSeen,
      metadata: metadata ?? this.metadata,
      peerType: peerType ?? this.peerType,
    );
  }
}
