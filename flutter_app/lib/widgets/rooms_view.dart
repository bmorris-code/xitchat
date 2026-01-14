import 'package:flutter/material.dart';
import '../models/chat.dart';
import '../theme/app_theme.dart';
import 'terminal_components.dart';

class RoomsView extends StatefulWidget {
  final List<Chat> rooms;
  final Function(String) onCreateRoom;
  final Function(String) onJoinRoom;

  const RoomsView({
    super.key,
    required this.rooms,
    required this.onCreateRoom,
    required this.onJoinRoom,
  });

  @override
  State<RoomsView> createState() => _RoomsViewState();
}

class _RoomsViewState extends State<RoomsView> {
  _RoomData? _confirmingRoom;

  // Public rooms matching web RoomsView
  final List<_RoomData> _publicRooms = [
    const _RoomData(id: 'room-gen', name: 'General Lobby', pop: 1240, desc: 'The main entrance to the mesh.', tags: ['chat', 'social']),
    const _RoomData(id: 'room-trade', name: 'Trading Floor', pop: 452, desc: 'Swap skins and stickers for XC.', tags: ['trade', 'moola']),
    const _RoomData(id: 'room-dev', name: 'Dev Void', pop: 89, desc: 'Talk tech, loops, and hardware.', tags: ['tech', 'hacking']),
    const _RoomData(id: 'room-flirt', name: 'The Pink Room', pop: 2105, desc: 'Local geohash matchmaking.', tags: ['dating', 'local']),
    const _RoomData(id: 'room-music', name: 'Audio Node', pop: 156, desc: 'Share signal frequencies.', tags: ['music', 'beats']),
  ];

  @override
  Widget build(BuildContext context) {
    return Container(
      color: AppTheme.background,
      child: Stack(
        children: [
          Column(
            children: [
              // Header
              Container(
                padding: const EdgeInsets.all(16),
                decoration: const BoxDecoration(
                  border: Border(bottom: BorderSide(color: AppTheme.darkGreen)),
                ),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    const Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        GlowText(text: 'room_protocol.bin', fontSize: 16),
                        SizedBox(height: 4),
                        Text(
                          'PUBLIC_MESH_NODES',
                          style: TextStyle(
                            fontSize: 9,
                            color: AppTheme.textMuted,
                            letterSpacing: 2,
                            fontFamily: 'monospace',
                          ),
                        ),
                      ],
                    ),
                    IconButton(
                      icon: const Icon(Icons.add, color: AppTheme.primaryGreen),
                      onPressed: () => _showCreateRoomDialog(context),
                    ),
                  ],
                ),
              ),

              // Rooms list
              Expanded(
                child: ListView.builder(
                  padding: const EdgeInsets.all(16),
                  itemCount: _publicRooms.length,
                  itemBuilder: (context, index) {
                    final room = _publicRooms[index];
                    return _buildRoomCard(room);
                  },
                ),
              ),

              // Scanning indicator
              Container(
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  border: Border.all(
                    color: AppTheme.darkGreen.withValues(alpha: 0.3),
                    style: BorderStyle.solid,
                  ),
                ),
                margin: const EdgeInsets.all(16),
                child: Text(
                  'SCANNING_FOR_PRIVATE_NODES...',
                  style: TextStyle(
                    color: AppTheme.darkGreen.withValues(alpha: 0.4),
                    fontSize: 10,
                    letterSpacing: 3,
                    fontFamily: 'monospace',
                  ),
                  textAlign: TextAlign.center,
                ),
              ),
            ],
          ),

          // Confirmation dialog overlay
          if (_confirmingRoom != null) _buildConfirmationDialog(),
        ],
      ),
    );
  }

  Widget _buildRoomCard(_RoomData room) {
    return GestureDetector(
      onTap: () => setState(() => _confirmingRoom = room),
      child: Container(
        margin: const EdgeInsets.only(bottom: 12),
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: AppTheme.surface,
          border: Border.all(color: AppTheme.darkGreen.withValues(alpha: 0.3)),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Expanded(
                  child: Row(
                    children: [
                      Text(
                        '#${room.name.toLowerCase().replaceAll(' ', '_')}',
                        style: const TextStyle(
                          color: Colors.white,
                          fontSize: 16,
                          fontWeight: FontWeight.bold,
                          fontFamily: 'monospace',
                        ),
                      ),
                      const SizedBox(width: 12),
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                        decoration: BoxDecoration(
                          border: Border.all(color: AppTheme.darkGreen),
                        ),
                        child: Text(
                          '${room.pop} ONLINE',
                          style: const TextStyle(
                            color: AppTheme.textMuted,
                            fontSize: 9,
                            fontFamily: 'monospace',
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
            const SizedBox(height: 8),
            Text(
              '> ${room.desc}',
              style: const TextStyle(
                color: AppTheme.textMuted,
                fontSize: 12,
                fontStyle: FontStyle.italic,
                fontFamily: 'monospace',
              ),
            ),
            const SizedBox(height: 12),
            Row(
              children: [
                Expanded(
                  child: Wrap(
                    spacing: 8,
                    children: room.tags.map((tag) => Text(
                      '[$tag]',
                      style: TextStyle(
                        color: AppTheme.darkGreen.withValues(alpha: 0.5),
                        fontSize: 8,
                        letterSpacing: 1,
                        fontFamily: 'monospace',
                      ),
                    )).toList(),
                  ),
                ),
                TerminalButton(
                  text: 'CONNECT_NODE',
                  onPressed: () => setState(() => _confirmingRoom = room),
                  isActive: true,
                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildConfirmationDialog() {
    final room = _confirmingRoom!;
    return Container(
      color: Colors.black.withValues(alpha: 0.8),
      child: Center(
        child: Container(
          margin: const EdgeInsets.all(32),
          padding: const EdgeInsets.all(24),
          decoration: BoxDecoration(
            color: AppTheme.background,
            border: Border.all(color: AppTheme.primaryGreen),
            boxShadow: AppTheme.glowShadow(AppTheme.primaryGreen),
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const GlowText(text: 'CONFIRM_CONNECTION', fontSize: 14),
              const SizedBox(height: 16),
              Text(
                'Join #${room.name.toLowerCase().replaceAll(' ', '_')}?',
                style: const TextStyle(
                  color: Colors.white,
                  fontSize: 16,
                  fontFamily: 'monospace',
                ),
              ),
              const SizedBox(height: 8),
              Text(
                '${room.pop} nodes currently connected',
                style: const TextStyle(
                  color: AppTheme.textMuted,
                  fontSize: 12,
                  fontFamily: 'monospace',
                ),
              ),
              const SizedBox(height: 24),
              Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  TerminalButton(
                    text: 'ABORT',
                    onPressed: () => setState(() => _confirmingRoom = null),
                    padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 12),
                  ),
                  const SizedBox(width: 16),
                  TerminalButton(
                    text: 'CONNECT',
                    onPressed: () {
                      widget.onJoinRoom(room.id);
                      setState(() => _confirmingRoom = null);
                    },
                    isActive: true,
                    padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 12),
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }

  void _showCreateRoomDialog(BuildContext context) {
    final controller = TextEditingController();
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        backgroundColor: AppTheme.background,
        title: const GlowText(text: 'CREATE_ROOM', fontSize: 14),
        content: TextField(
          controller: controller,
          style: const TextStyle(
            color: Colors.white,
            fontFamily: 'monospace',
          ),
          decoration: InputDecoration(
            hintText: 'room_name',
            hintStyle: TextStyle(
              color: AppTheme.darkGreen.withValues(alpha: 0.5),
              fontFamily: 'monospace',
            ),
            enabledBorder: const OutlineInputBorder(
              borderSide: BorderSide(color: AppTheme.darkGreen),
            ),
            focusedBorder: const OutlineInputBorder(
              borderSide: BorderSide(color: AppTheme.primaryGreen),
            ),
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(context).pop(),
            child: const Text('ABORT', style: TextStyle(color: AppTheme.darkGreen)),
          ),
          TextButton(
            onPressed: () {
              if (controller.text.isNotEmpty) {
                widget.onCreateRoom(controller.text);
                Navigator.of(context).pop();
              }
            },
            child: const Text('CREATE', style: TextStyle(color: AppTheme.primaryGreen)),
          ),
        ],
      ),
    );
  }
}

class _RoomData {
  final String id;
  final String name;
  final int pop;
  final String desc;
  final List<String> tags;

  const _RoomData({
    required this.id,
    required this.name,
    required this.pop,
    required this.desc,
    required this.tags,
  });
}
