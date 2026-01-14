import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import '../models/chat.dart';

// Terminal color constants
const Color kTerminalGreen = Color(0xFF00FF01);
const Color kTerminalDarkGreen = Color(0xFF004400);
const Color kTerminalBg = Colors.black;
const Color kTerminalCyan = Color(0xFF00FFFF);
const Color kTerminalOrange = Colors.orangeAccent;

class ChatView extends StatefulWidget {
  final List<Chat> chats;
  final List<Message> messages;
  final Function(String, String) onSendMessage;
  final Function(String, String) onAddReaction;
  final Function(String)? onDeleteMessage;
  final Function(String, String)? onForwardMessage;
  final Function(String, String)? onReplyToMessage;

  const ChatView({
    super.key,
    required this.chats,
    required this.messages,
    required this.onSendMessage,
    required this.onAddReaction,
    this.onDeleteMessage,
    this.onForwardMessage,
    this.onReplyToMessage,
  });

  @override
  State<ChatView> createState() => _ChatViewState();
}

class _ChatViewState extends State<ChatView> {
  final TextEditingController _controller = TextEditingController();
  final ScrollController _scrollController = ScrollController();
  String? _activeChatId;

  @override
  Widget build(BuildContext context) {
    // If no active chat, show chat list
    if (_activeChatId == null) {
      return _buildChatList();
    }

    // Show active chat window
    final activeChat = widget.chats.firstWhere(
      (c) => c.id == _activeChatId,
      orElse: () => widget.chats.isNotEmpty ? widget.chats.first : 
        Chat(id: 'default', name: 'Unknown', lastMessage: '', lastMessageTime: DateTime.now()),
    );
    
    return _buildChatWindow(activeChat);
  }

  Widget _buildChatList() {
    return Scaffold(
      backgroundColor: kTerminalBg,
      body: SafeArea(
        child: Column(
          children: [
            // Header matching web ChatList
            Container(
              padding: const EdgeInsets.all(16),
              decoration: const BoxDecoration(
                border: Border(bottom: BorderSide(color: kTerminalDarkGreen)),
              ),
              child: const Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Text(
                        'xitchat',
                        style: TextStyle(
                          color: kTerminalGreen,
                          fontSize: 20,
                          fontWeight: FontWeight.bold,
                          fontFamily: 'monospace',
                        ),
                      ),
                      Text(
                        'MESH: ACTIVE',
                        style: TextStyle(
                          fontSize: 9,
                          color: kTerminalDarkGreen,
                          letterSpacing: 1,
                          fontFamily: 'monospace',
                        ),
                      ),
                    ],
                  ),
                  SizedBox(height: 4),
                  Text(
                    'decentralized geohash messaging',
                    style: TextStyle(
                      fontSize: 9,
                      color: kTerminalDarkGreen,
                      fontStyle: FontStyle.italic,
                      fontFamily: 'monospace',
                    ),
                  ),
                ],
              ),
            ),

            // Active nodes header
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  const Row(
                    children: [
                      Icon(Icons.hub, size: 10, color: kTerminalDarkGreen),
                      SizedBox(width: 8),
                      Text(
                        'ACTIVE_NODES',
                        style: TextStyle(
                          fontSize: 10,
                          color: kTerminalDarkGreen,
                          fontWeight: FontWeight.bold,
                          letterSpacing: 2,
                          fontFamily: 'monospace',
                        ),
                      ),
                    ],
                  ),
                  GestureDetector(
                    onTap: () {
                      // TODO: Show invite/scan modal
                    },
                    child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                      decoration: BoxDecoration(
                        border: Border.all(color: kTerminalDarkGreen),
                      ),
                      child: const Text(
                        '+ SCAN',
                        style: TextStyle(
                          fontSize: 9,
                          color: kTerminalDarkGreen,
                          fontFamily: 'monospace',
                        ),
                      ),
                    ),
                  ),
                ],
              ),
            ),

            // Chat list
            Expanded(
              child: widget.chats.isEmpty
                  ? const Center(
                      child: Text(
                        'NO_ACTIVE_NODES',
                        style: TextStyle(
                          color: kTerminalDarkGreen,
                          fontSize: 12,
                          letterSpacing: 2,
                          fontFamily: 'monospace',
                        ),
                      ),
                    )
                  : ListView.builder(
                      itemCount: widget.chats.length,
                      itemBuilder: (context, index) {
                        final chat = widget.chats[index];
                        return _buildChatListItem(chat);
                      },
                    ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildChatListItem(Chat chat) {
    final isBot = chat.id == 'xit-bot';

    return GestureDetector(
      onTap: () => setState(() => _activeChatId = chat.id),
      child: Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          border: const Border(
            bottom: BorderSide(color: Colors.transparent),
          ),
          color: _activeChatId == chat.id
              ? Colors.white.withValues(alpha: 0.05)
              : Colors.transparent,
        ),
        child: Row(
          children: [
            // Status dot
            Container(
              width: 8,
              height: 8,
              decoration: const BoxDecoration(
                color: kTerminalGreen,
                shape: BoxShape.circle,
              ),
            ),
            const SizedBox(width: 16),

            // Chat info
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Text(
                        chat.name,
                        style: GoogleFonts.sourceCodePro(
                          color: kTerminalGreen,
                          fontSize: 14,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                      if (chat.unreadCount > 0)
                        const Text(
                          '[!]',
                          style: TextStyle(
                            color: kTerminalGreen,
                            fontSize: 10,
                            fontFamily: 'monospace',
                          ),
                        ),
                    ],
                  ),
                  const SizedBox(height: 4),
                  Text(
                    '> ${chat.lastMessage}',
                    style: GoogleFonts.sourceCodePro(
                      color: kTerminalDarkGreen,
                      fontSize: 11,
                    ),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildChatWindow(Chat chat) {
    final chatMessages = widget.messages.where((m) => m.chatId == chat.id).toList();

    return Scaffold(
      backgroundColor: kTerminalBg,
      body: SafeArea(
        child: Column(
          children: [
            _buildHeader(chat),
            _buildSessionBanner(),
            Expanded(child: _buildMessageList(chatMessages)),
            _buildInputArea(),
          ],
        ),
      ),
    );
  }

  // HEADER: Directly translated from the React Header section
  Widget _buildHeader(Chat chat) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
      decoration: const BoxDecoration(
        border: Border(bottom: BorderSide(color: kTerminalDarkGreen)),
      ),
      child: Row(
        children: [
          IconButton(
            icon: const Icon(Icons.arrow_back, color: kTerminalGreen, size: 20),
            onPressed: () => setState(() => _activeChatId = null),
          ),
          Expanded(
            child: Row(
              children: [
                Text(
                  "xitchat/",
                  style: GoogleFonts.sourceCodePro(color: kTerminalGreen, fontWeight: FontWeight.bold),
                ),
                Text(
                  chat.name.toUpperCase(),
                  style: GoogleFonts.sourceCodePro(
                    color: kTerminalGreen,
                    fontWeight: FontWeight.bold,
                    letterSpacing: 2,
                  ),
                ),
                const SizedBox(width: 8),
                Container(
                  width: 8, height: 8,
                  decoration: const BoxDecoration(color: kTerminalGreen, shape: BoxShape.circle),
                ),
              ],
            ),
          ),
          // Status Buttons from React (TOR, POW, etc.)
          _statusButton("TOR", Colors.green),
          _statusButton("POW", Colors.blue),
          const SizedBox(width: 4),
          _iconButton(Icons.lock_outline, Colors.orange),
          const SizedBox(width: 4),
          _iconButton(Icons.close, kTerminalGreen),
        ],
      ),
    );
  }

  // SESSION BANNER: "- session_initialized: date -"
  Widget _buildSessionBanner() {
    return Container(
      padding: const EdgeInsets.symmetric(vertical: 20),
      child: Center(
        child: Text(
          "- SESSION_INITIALIZED: ${DateTime.now().day}/${DateTime.now().month}/${DateTime.now().year} -",
          style: GoogleFonts.sourceCodePro(
            color: kTerminalDarkGreen,
            fontSize: 10,
            letterSpacing: 3,
          ),
        ),
      ),
    );
  }

  // MESSAGES: List of flat terminal text (No Bubbles)
  Widget _buildMessageList(List<Message> messages) {
    return ListView.builder(
      controller: _scrollController,
      padding: const EdgeInsets.symmetric(horizontal: 16),
      itemCount: messages.length,
      itemBuilder: (context, index) {
        final msg = messages[index];
        final bool isMe = msg.isMe;
        
        return Padding(
          padding: const EdgeInsets.only(bottom: 16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Header line: <sender> [time]
              Row(
                children: [
                  Text(
                    "<${isMe ? 'myHandle' : msg.senderId}>",
                    style: GoogleFonts.sourceCodePro(
                      color: isMe ? kTerminalGreen : kTerminalOrange,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                  const SizedBox(width: 8),
                  Text(
                    "[${_formatTimeWithPeriod(msg.timestamp)}]",
                    style: GoogleFonts.sourceCodePro(color: kTerminalDarkGreen, fontSize: 10),
                  ),
                ],
              ),
              const SizedBox(height: 4),
              // Message text content
              Text(
                msg.content,
                style: GoogleFonts.sourceCodePro(color: Colors.white, fontSize: 15),
              ),
            ],
          ),
        );
      },
    );
  }

  // INPUT AREA: Row of icons + Prompt + Field
  Widget _buildInputArea() {
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: const BoxDecoration(
        border: Border(top: BorderSide(color: kTerminalDarkGreen)),
      ),
      child: Column(
        children: [
          // Attachment Icon Row (React: Media Sharing Bar)
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceAround,
            children: [
              _attachIcon(Icons.face_outlined),
              _attachIcon(Icons.image_outlined),
              _attachIcon(Icons.videocam_outlined),
              _attachIcon(Icons.camera_alt_outlined),
              _attachIcon(Icons.location_on_outlined),
              _attachIcon(Icons.contact_page_outlined),
            ],
          ),
          const SizedBox(height: 12),
          // Actual input row: > text field [security] [send]
          Row(
            children: [
              Text(">", style: GoogleFonts.sourceCodePro(color: kTerminalGreen, fontSize: 20, fontWeight: FontWeight.bold)),
              const SizedBox(width: 10),
              Expanded(
                child: TextField(
                  controller: _controller,
                  style: GoogleFonts.sourceCodePro(color: Colors.white),
                  decoration: InputDecoration(
                    hintText: "type message...",
                    hintStyle: GoogleFonts.sourceCodePro(color: kTerminalDarkGreen),
                    border: InputBorder.none,
                  ),
                  onSubmitted: (_) => _sendMessage(),
                ),
              ),
              _securityIcon(Icons.shield, Colors.green),
              _securityIcon(Icons.lock, Colors.blue),
              _securityIcon(Icons.settings, kTerminalGreen),
              const SizedBox(width: 10),
              GestureDetector(
                onTap: () => _sendMessage(),
                child: Container(
                  padding: const EdgeInsets.all(8),
                  decoration: const BoxDecoration(color: kTerminalGreen, shape: BoxShape.circle),
                  child: const Icon(Icons.send, color: Colors.black, size: 16),
                ),
              )
            ],
          ),
        ],
      ),
    );
  }

  // Helper Widgets to match the high-density React UI
  Widget _statusButton(String label, Color color) {
    return Container(
      margin: const EdgeInsets.only(left: 4),
      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
      decoration: BoxDecoration(
        color: color.withOpacity(0.1),
        border: Border.all(color: color.withOpacity(0.5)),
      ),
      child: Text(label, style: GoogleFonts.sourceCodePro(color: color, fontSize: 9, fontWeight: FontWeight.bold)),
    );
  }

  Widget _iconButton(IconData icon, Color color) {
    return Container(
      padding: const EdgeInsets.all(4),
      decoration: BoxDecoration(border: Border.all(color: kTerminalDarkGreen)),
      child: Icon(icon, color: color, size: 14),
    );
  }

  Widget _attachIcon(IconData icon) {
    return Icon(icon, color: kTerminalGreen.withOpacity(0.6), size: 20);
  }

  Widget _securityIcon(IconData icon, Color color) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 4),
      child: Icon(icon, color: color, size: 16),
    );
  }

  String _formatTimeWithPeriod(DateTime time) {
    final hour = time.hour;
    final period = hour >= 12 ? 'PM' : 'AM';
    final displayHour = hour > 12 ? hour - 12 : (hour == 0 ? 12 : hour);
    return '${displayHour.toString().padLeft(2, '0')}:${time.minute.toString().padLeft(2, '0')} $period';
  }

  void _sendMessage() {
    if (_controller.text.isNotEmpty && _activeChatId != null) {
      widget.onSendMessage(_activeChatId!, _controller.text);
      _controller.clear();
    }
  }

  @override
  void dispose() {
    _controller.dispose();
    _scrollController.dispose();
    super.dispose();
  }
}
