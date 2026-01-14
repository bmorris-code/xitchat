// import 'package:flutter/foundation.dart';
// import 'package:xitchat_mobile/models.dart';
// import '../models/chat.dart';
// import '../working_p2p_service.dart';
// import '../services/xc_economy.dart';
// import '../services/tor_service.dart';
// import '../services/pow_service.dart';
// import '../services/simple_encryption_service.dart';

// class AppProvider extends ChangeNotifier {
//   final WorkingP2PService _meshService = WorkingP2PService();
//   final XCEconomy _xcEconomy = XCEconomy();
//   final TorService _torService = TorService();
//   final PoWService _powService = PoWService();
//   final SimpleEncryptionService _encryptionService = SimpleEncryptionService();
  
//   List<Chat> _chats = [];
//   final List<Message> _messages = [];
//   final Map<String, User> _connectedPeers = {};
//   User? _currentUser;
//   int _currentBalance = 0;
//   bool _isDiscovering = false;
//   bool _isRealMode = false;
//   String _currentView = 'chats';
  
//   // Getters
//   List<Chat> get chats => _chats;
//   List<Message> get messages => _messages;
//   User? get currentUser => _currentUser;
//   int get currentBalance => _currentBalance;
//   bool get isDiscovering => _isDiscovering;
//   bool get isRealMode => _isRealMode;
//   String get currentView => _currentView;
//   List<MeshPeer> get discoveredPeers => _meshService.getPeers();
//   Map<String, User> get connectedPeers {
//   _connectedPeers.clear();
//   for (final peer in _meshService.getConnectedPeers()) {
//     final user = User(
//       id: peer.id,
//       handle: peer.handle,
//       name: peer.name,
//       isOnline: peer.isConnected,
//       discoveryMethod: peer.discoveryMethod,
//       signalStrength: peer.signalStrength,
//       distance: peer.distance,
//     );
//     _connectedPeers[peer.id] = user;
//   }
//   return _connectedPeers;
// }

//   AppProvider() {
//     _initializeApp();
//   }

//   Future<void> _initializeApp() async {
//     await _meshService.initialize();
//     await _xcEconomy.initialize();
//     await _torService.initialize();
//     await _powService.initialize();
//     await _encryptionService.initialize();
    
//     } catch (error) {
//       debugPrint('⚠️ Nostr initialization failed: $error');
//     }

//     // Listen to mesh service streams
//     _meshService.events.listen((event) {
//       final eventType = event.keys.first;
//       final data = event[eventType];

//       switch (eventType) {
//         case 'peerDiscovered':
//           notifyListeners();
//           break;
//         case 'messageReceived':
//           _handleIncomingMessage(data);
//           break;
//         case 'peerConnected':
//           _handleConnectionEvent('connected:${data['id']}');
//           break;
//         case 'peerDisconnected':
//           _handleConnectionEvent('disconnected:${data['id']}');
//           break;
//       }
//     });

//     // Listen to Nostr service streams
//     _nostrService.events.listen((event) {
//       final eventType = event.keys.first;
//       final data = event[eventType];

//       switch (eventType) {
//         case 'messageReceived':
//           _handleNostrMessage(data);
//           break;
//         case 'peerUpdated':
//           notifyListeners();
//           break;
//         case 'initialized':
//           debugPrint('🌐 Nostr connected - Public key: ${data['publicKey']}');
//           notifyListeners();
//           break;
//       }
//     });

//     // Listen to XC economy streams
//     _xcEconomy.balanceStream.listen((balance) {
//       _currentBalance = balance;
//       notifyListeners();
//     });

//     _xcEconomy.transactionStream.listen((transaction) {
//       notifyListeners();
//     });
    
//     _currentBalance = _xcEconomy.balance;
    
//     // Create current user
//     _currentUser = User(
//       id: _meshService.myPeerId ?? 'current_user',
//       handle: 'You',
//       name: 'Current User',
//       isOnline: true,
//     );
    
//     // Initialize with some demo chats
//     _initializeDemoChats();
    
//     notifyListeners();
//   }

//   void _initializeDemoChats() {
//     _chats = [
//       Chat(
//         id: '1',
//         name: 'General Mesh',
//         lastMessage: 'Welcome to XitChat Mobile!',
//         lastMessageTime: DateTime.now(),
//         isGroup: true,
//         participants: ['user1', 'user2'],
//         isMeshEnabled: true,
//         isEncrypted: true,
//       ),
//       Chat(
//         id: '2',
//         name: 'XC Trading',
//         lastMessage: 'Check out the marketplace!',
//         lastMessageTime: DateTime.now().subtract(const Duration(minutes: 5)),
//         isGroup: true,
//         participants: ['trader1', 'trader2'],
//         isMeshEnabled: true,
//       ),
//     ];
//   }

//   void setCurrentView(String view) {
//     _currentView = view;
//     notifyListeners();
//   }

//   Future<void> toggleDiscoveryMode() async {
//     _isRealMode = !_isRealMode;
    
//     if (_isDiscovering) {
//       _meshService.stopDiscovery();
//       _isDiscovering = false;
//     }
    
//     notifyListeners();
//   }

//   Future<void> startDiscovery() async {
//     if (_isDiscovering) return;
    
//     _isDiscovering = true;
//     await _meshService.startDiscovery();
//     notifyListeners();
//   }

//   Future<void> stopDiscovery() async {
//     if (!_isDiscovering) return;
    
//     _meshService.stopDiscovery();
//     _isDiscovering = false;
//     notifyListeners();
//   }

//   Future<void> connectToPeer(String peerId) async {
//     await _meshService.sendMessage(peerId, "Connection request");
    
//     // Award XC for connecting
//     await _xcEconomy.addBalance(5, 'Connected to new peer');
//     notifyListeners();
//   }

//   Future<void> disconnectFromPeer(String peerId) async {
//     // Disconnect logic handled by mesh service
//     notifyListeners();
//   }

//   Future<void> sendMessage(String chatId, String content) async {
//     final message = Message(
//       id: DateTime.now().millisecondsSinceEpoch.toString(),
//       chatId: chatId,
//       senderId: _currentUser?.id ?? 'current_user',
//       content: content,
//       timestamp: DateTime.now(),
//       isMe: true,
//     );
    
//     _messages.add(message);
    
//     // Update chat's last message
//     final chatIndex = _chats.indexWhere((chat) => chat.id == chatId);
//     if (chatIndex != -1) {
//       _chats[chatIndex] = _chats[chatIndex].copyWith(
//         lastMessage: content,
//         lastMessageTime: DateTime.now(),
//       );
//     }
    
//     // Broadcast via mesh if enabled
//     final chat = _chats.firstWhere((c) => c.id == chatId);
//     if (chat.isMeshEnabled) {
//       // Send to all connected peers
//       final connectedPeers = _meshService.getConnectedPeers();
//       for (final peer in connectedPeers) {
//         _meshService.sendMessage(peer.id, content);
//       }
//     }
    
//     // Award XC for messaging
//     await _xcEconomy.addBalance(1, 'Message sent');
//     notifyListeners();
//   }

//   void _handleIncomingMessage(Map<String, dynamic> messageData) {
//     final message = Message(
//       id: messageData['id'] ?? DateTime.now().millisecondsSinceEpoch.toString(),
//       chatId: messageData['chatId'] ?? '1',
//       senderId: messageData['from'] ?? 'unknown',
//       content: messageData['content'] ?? '',
//       timestamp: DateTime.parse(messageData['timestamp'] ?? DateTime.now().toIso8601String()),
//       isMe: false,
//     );
    
//     _messages.add(message);
//     notifyListeners();
//   }

//   void _handleConnectionEvent(String event) {
//     if (event.startsWith('connected:')) {
//       final peerId = event.split(':')[1];
//       _xcEconomy.addBalance(10, 'Peer connected: $peerId');
//     } else if (event.startsWith('disconnected:')) {
//       // Handle disconnection
//     }
//     notifyListeners();
//   }

//   void _handleNostrMessage(dynamic data) {
//     // Handle incoming Nostr message (global P2P)
//     final message = Message(
//       id: data['id'] ?? DateTime.now().millisecondsSinceEpoch.toString(),
//       chatId: data['from'] ?? 'nostr',
//       senderId: data['from'] ?? 'unknown',
//       content: data['content'] ?? '',
//       timestamp: data['timestamp'] ?? DateTime.now(),
//       isMe: false,
//     );

//     _messages.add(message);

//     // Create chat if it doesn't exist
//     final chatId = data['from'] ?? 'nostr';
//     if (!_chats.any((chat) => chat.id == chatId)) {
//       _chats.add(Chat(
//         id: chatId,
//         name: 'Nostr ${chatId.substring(0, 8)}',
//         lastMessage: data['content'] ?? '',
//         lastMessageTime: data['timestamp'] ?? DateTime.now(),
//         isGroup: false,
//         participants: [chatId],
//         isMeshEnabled: true,
//         isEncrypted: true,
//       ));
//     }

//     // Award XC for receiving global message
//     _xcEconomy.addBalance(2, 'Received Nostr message');

//     notifyListeners();
//   }

//   Future<bool> purchaseItem(String itemId, int cost) async {
//     final success = await _xcEconomy.purchaseItem(itemId, cost);
//     if (success) {
//       notifyListeners();
//     }
//     return success;
//   }

//   Future<bool> sellItem(String itemId, int price) async {
//     final success = await _xcEconomy.sellItem(itemId, price);
//     if (success) {
//       notifyListeners();
//     }
//     return success;
//   }

//   List<XCTransaction> getTransactions() {
//     return _xcEconomy.transactions;
//   }

//   Map<String, int> getInventory() {
//     return _xcEconomy.inventory;
//   }

//   Set<String> getAchievements() {
//     return _xcEconomy.achievements;
//   }

//   Future<void> awardMeshActivity() async {
//     final connectedPeers = _meshService.getConnectedPeers().length;
//     final messagesExchanged = _messages.where((m) => m.isMe).length;
    
//     await _xcEconomy.awardMeshActivity(connectedPeers, messagesExchanged);
//     notifyListeners();
//   }

//   void addReaction(String messageId, String emoji) {
//     final messageIndex = _messages.indexWhere((m) => m.id == messageId);
//     if (messageIndex != -1) {
//       final message = _messages[messageIndex];
//       final reaction = Reaction(
//         emoji: emoji,
//         userId: _currentUser?.id ?? 'current_user',
//         timestamp: DateTime.now(),
//       );
      
//       _messages[messageIndex] = Message(
//         id: message.id,
//         chatId: message.chatId,
//         senderId: message.senderId,
//         content: message.content,
//         timestamp: message.timestamp,
//         isMe: message.isMe,
//         attachmentUrl: message.attachmentUrl,
//         attachmentType: message.attachmentType,
//         reactions: [...message.reactions, reaction],
//         isEncrypted: message.isEncrypted,
//         isDelivered: message.isDelivered,
//         isRead: message.isRead,
//       );
      
//       notifyListeners();
//     }
//   }

//   Future<void> createRoom(String roomName) async {
//     final roomId = _meshService.createLocalRoom(roomName);
    
//     final newChat = Chat(
//       id: roomId,
//       name: roomName,
//       lastMessage: 'Room created',
//       lastMessageTime: DateTime.now(),
//       isGroup: true,
//       participants: [_currentUser?.id ?? 'current_user'],
//       isMeshEnabled: true,
//       isEncrypted: true,
//     );
    
//     _chats.insert(0, newChat);
//     notifyListeners();
//   }

//   Future<void> joinRoom(String chatId) async {
//     final chatIndex = _chats.indexWhere((chat) => chat.id == chatId);
//     if (chatIndex != -1) {
//       final chat = _chats[chatIndex];
//       final updatedParticipants = [...chat.participants, _currentUser?.id ?? 'current_user'];
      
//       _chats[chatIndex] = chat.copyWith(participants: updatedParticipants);
//       notifyListeners();
//     }
//   }

//   List<Chat> getRooms() {
//     return _chats.where((chat) => chat.isGroup).toList();
//   }

//   @override
//   void dispose() {
//     _meshService.disconnect();
//     _xcEconomy.dispose();
//     super.dispose();
//   }
// }
