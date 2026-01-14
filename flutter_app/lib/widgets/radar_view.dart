import 'dart:math';
import 'package:flutter/material.dart';
import '../models/chat.dart';
import '../theme/app_theme.dart';
import 'terminal_components.dart';

// Custom painter for grid background
class GridPainter extends CustomPainter {
  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()
      ..color = AppTheme.darkGreen.withValues(alpha: 0.1)
      ..strokeWidth = 1;

    // Draw grid lines
    const gridSize = 50.0;
    for (double x = 0; x < size.width; x += gridSize) {
      canvas.drawLine(Offset(x, 0), Offset(x, size.height), paint);
    }
    for (double y = 0; y < size.height; y += gridSize) {
      canvas.drawLine(Offset(0, y), Offset(size.width, y), paint);
    }

    // Draw radar circles
    final center = Offset(size.width / 2, size.height / 2);
    final circlePaint = Paint()
      ..color = AppTheme.darkGreen.withValues(alpha: 0.2)
      ..strokeWidth = 1
      ..style = PaintingStyle.stroke;

    for (double radius = 50; radius <= 200; radius += 50) {
      canvas.drawCircle(center, radius, circlePaint);
    }
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}

class RadarView extends StatefulWidget {
  final List<User> peers;
  final Map<String, User> connectedPeers;
  final bool isRealMode;
  final bool isDiscovering;
  final Function(String) onConnectPeer;
  final Function(String) onDisconnectPeer;
  final VoidCallback onToggleMode;
  final VoidCallback onStartDiscovery;
  final VoidCallback onStopDiscovery;
  final Function(User) onUserSelect;

  const RadarView({
    super.key,
    required this.peers,
    required this.connectedPeers,
    required this.isRealMode,
    required this.isDiscovering,
    required this.onConnectPeer,
    required this.onDisconnectPeer,
    required this.onToggleMode,
    required this.onStartDiscovery,
    required this.onStopDiscovery,
    required this.onUserSelect,
  });

  @override
  State<RadarView> createState() => _RadarViewState();
}

class _RadarViewState extends State<RadarView> with TickerProviderStateMixin {
  late AnimationController _radarController;
  late AnimationController _pulseController;
  int _signalStrength = 75;
  User? _selectedPeer;
  String _viewMode = 'grid'; // 'grid' or 'list'
  final String _currentGeohash = '428F';

  @override
  void initState() {
    super.initState();
    _radarController = AnimationController(
      duration: const Duration(seconds: 3),
      vsync: this,
    )..repeat();

    _pulseController = AnimationController(
      duration: const Duration(milliseconds: 1500),
      vsync: this,
    )..repeat(reverse: true);

    // Simulate signal fluctuation
    _startSignalFluctuation();
  }

  void _startSignalFluctuation() {
    Future.delayed(const Duration(seconds: 2), () {
      if (mounted) {
        setState(() {
          final delta = Random().nextInt(5) - 2;
          _signalStrength = (_signalStrength + delta).clamp(20, 100);
        });
        _startSignalFluctuation();
      }
    });
  }

  @override
  void dispose() {
    _radarController.dispose();
    _pulseController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Stack(
      children: [
        Container(
          color: AppTheme.background,
          child: Column(
            children: [
              _buildHeader(),
              Expanded(child: _buildMainContent()),
              _buildStatsBar(),
            ],
          ),
        ),
        // Peer interaction modal
        if (_selectedPeer != null)
          _buildPeerInteractionModal(),
      ],
    );
  }

  Widget _buildHeader() {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: const BoxDecoration(
        border: Border(bottom: BorderSide(color: AppTheme.darkGreen)),
      ),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const GlowText(text: 'geohash/radar.exe', fontSize: 16),
              const SizedBox(height: 4),
              Text(
                'scanning zone #$_currentGeohash | SIGNAL: $_signalStrength% | NODES: ${widget.peers.length}',
                style: const TextStyle(
                  color: AppTheme.darkGreen,
                  fontSize: 8,
                  letterSpacing: 1,
                  fontFamily: 'monospace',
                ),
              ),
              const SizedBox(height: 2),
              Row(
                children: [
                  Container(
                    width: 8,
                    height: 8,
                    decoration: BoxDecoration(
                      color: widget.isRealMode
                          ? Colors.red
                          : AppTheme.primaryGreen,
                      borderRadius: BorderRadius.circular(4),
                    ),
                  ),
                  const SizedBox(width: 6),
                  Text(
                    widget.isRealMode ? '🔴 REAL MODE' : '🟢 SIMULATED MODE',
                    style: TextStyle(
                      fontSize: 9,
                      color:
                          widget.isRealMode ? Colors.red : AppTheme.primaryGreen,
                      letterSpacing: 2,
                      fontFamily: 'monospace',
                    ),
                  ),
                ],
              ),
            ],
          ),
          Row(
            children: [
              _buildSignalIndicator(),
              const SizedBox(width: 8),
              GestureDetector(
                onTap: () => setState(() => _viewMode = _viewMode == 'grid' ? 'list' : 'grid'),
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                  decoration: BoxDecoration(
                    border: Border.all(color: AppTheme.darkGreen),
                    color: _viewMode == 'grid' ? AppTheme.primaryGreen : Colors.transparent,
                  ),
                  child: Text(
                    _viewMode.toUpperCase(),
                    style: TextStyle(
                      color: _viewMode == 'grid' ? Colors.black : AppTheme.primaryGreen,
                      fontSize: 8,
                      fontWeight: FontWeight.bold,
                      fontFamily: 'monospace',
                    ),
                  ),
                ),
              ),
              const SizedBox(width: 8),
              GestureDetector(
                onTap: widget.onToggleMode,
                child: Container(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                  decoration: BoxDecoration(
                    border: Border.all(
                      color: widget.isRealMode
                          ? Colors.red
                          : AppTheme.primaryGreen,
                    ),
                  ),
                  child: Text(
                    widget.isRealMode ? 'REAL' : 'SIM',
                    style: TextStyle(
                      color: widget.isRealMode
                          ? Colors.red
                          : AppTheme.primaryGreen,
                      fontSize: 10,
                      fontWeight: FontWeight.bold,
                      fontFamily: 'monospace',
                    ),
                  ),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildMainContent() {
    if (_viewMode == 'grid') {
      return _buildRadarGrid();
    } else {
      return _buildPeerList();
    }
  }

  Widget _buildStatsBar() {
    return Container(
      margin: const EdgeInsets.all(4),
      child: Row(
        children: [
          Expanded(
            child: Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: AppTheme.surface,
                border: Border.all(color: AppTheme.darkGreen),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text(
                    'Signal Fidelity',
                    style: TextStyle(
                      fontSize: 8,
                      color: AppTheme.darkGreen,
                      fontWeight: FontWeight.bold,
                      fontFamily: 'monospace',
                    ),
                  ),
                  const SizedBox(height: 4),
                  Container(
                    height: 4,
                    decoration: BoxDecoration(
                      color: AppTheme.surface,
                      borderRadius: BorderRadius.circular(2),
                    ),
                    child: FractionallySizedBox(
                      alignment: Alignment.centerLeft,
                      widthFactor: _signalStrength / 100,
                      child: Container(
                        decoration: BoxDecoration(
                          color: AppTheme.primaryGreen,
                          borderRadius: BorderRadius.circular(2),
                        ),
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ),
          const SizedBox(width: 8),
          Expanded(
            child: Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: AppTheme.surface,
                border: Border.all(color: AppTheme.darkGreen),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text(
                    'total_peers',
                    style: TextStyle(
                      fontSize: 8,
                      color: AppTheme.darkGreen,
                      fontWeight: FontWeight.bold,
                      fontFamily: 'monospace',
                    ),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    '${widget.peers.length} DISCOVERED',
                    style: const TextStyle(
                      fontSize: 10,
                      color: Colors.white,
                      fontWeight: FontWeight.bold,
                      fontFamily: 'monospace',
                    ),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildSignalIndicator() {
    return Row(
      children: [
        Icon(
          Icons.signal_cellular_alt,
          size: 16,
          color: _signalStrength > 60 ? AppTheme.primaryGreen : Colors.amber,
        ),
        const SizedBox(width: 4),
        Text(
          '$_signalStrength%',
          style: const TextStyle(
            color: AppTheme.primaryGreen,
            fontSize: 10,
            fontFamily: 'monospace',
          ),
        ),
      ],
    );
  }

  Widget _buildRadarGrid() {
    return Stack(
      alignment: Alignment.center,
      children: [
        // Grid background
        CustomPaint(
          size: const Size(double.infinity, double.infinity),
          painter: GridPainter(),
        ),

        // Radar circles
        ...List.generate(4, (index) {
          return AnimatedBuilder(
            animation: _pulseController,
            builder: (context, child) {
              final size = 80.0 + (index * 60) + (_pulseController.value * 10);
              return Container(
                width: size,
                height: size,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  border: Border.all(
                    color: AppTheme.darkGreen
                        .withValues(alpha: 0.3 - (index * 0.05)),
                    width: 1,
                  ),
                ),
              );
            },
          );
        }),

        // Radar sweep
        AnimatedBuilder(
          animation: _radarController,
          builder: (context, child) {
            return Transform.rotate(
              angle: _radarController.value * 2 * pi,
              child: Container(
                width: 200,
                height: 200,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  gradient: SweepGradient(
                    colors: [
                      Colors.transparent,
                      AppTheme.primaryGreen.withValues(alpha: 0.3),
                      Colors.transparent,
                    ],
                    stops: const [0.0, 0.1, 0.2],
                  ),
                ),
              ),
            );
          },
        ),

        // Center node (you)
        Container(
          width: 20,
          height: 20,
          decoration: BoxDecoration(
            color: AppTheme.primaryGreen,
            shape: BoxShape.circle,
            boxShadow: AppTheme.glowShadow(AppTheme.primaryGreen),
          ),
          child: const Icon(Icons.person, size: 12, color: Colors.black),
        ),

        // Peer nodes
        ...widget.peers.asMap().entries.map((entry) {
          final index = entry.key;
          final peer = entry.value;
          final angle = (index * (2 * pi / max(widget.peers.length, 1))) - (pi / 2);
          final distance = 60.0 + (index % 3) * 40;
          final x = cos(angle) * distance;
          final y = sin(angle) * distance;
          final isConnected = widget.connectedPeers.containsKey(peer.id);

          return Transform.translate(
            offset: Offset(x, y),
            child: GestureDetector(
              onTap: () => _showPeerInteraction(peer),
              child: _buildPeerNode(peer, isConnected),
            ),
          );
        }),

        // Discovery button
        Positioned(
          bottom: 20,
          child: TerminalButton(
            text: widget.isDiscovering ? 'STOP_SCAN' : 'START_SCAN',
            onPressed: widget.isDiscovering
                ? widget.onStopDiscovery
                : widget.onStartDiscovery,
            isActive: widget.isDiscovering,
          ),
        ),
      ],
    );
  }

  Widget _buildPeerInteractionModal() {
    if (_selectedPeer == null) return const SizedBox.shrink();
    
    final peer = _selectedPeer!;
    final isConnected = widget.connectedPeers.containsKey(peer.id);
    Color peerColor;
    
    switch (peer.peerType) {
      case PeerType.bluetooth:
        peerColor = AppTheme.primaryGreen;
        break;
      case PeerType.wifi:
        peerColor = Colors.cyan;
        break;
      case PeerType.real:
        peerColor = Colors.red;
        break;
      case PeerType.mesh:
        // TODO: Handle this case.
        throw UnimplementedError();
    }

    return GestureDetector(
      onTap: () => setState(() => _selectedPeer = null),
      child: Container(
        color: Colors.black.withValues(alpha: 0.9),
        child: Center(
          child: GestureDetector(
            onTap: () {}, // Prevent tap through
            child: Container(
              margin: const EdgeInsets.all(20),
              padding: const EdgeInsets.all(20),
              decoration: BoxDecoration(
                color: AppTheme.surface,
                border: Border.all(color: peerColor),
                borderRadius: BorderRadius.circular(8),
              ),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  // Header
                  Row(
                    children: [
                      Container(
                        width: 40,
                        height: 40,
                        decoration: BoxDecoration(
                          color: peerColor,
                          shape: BoxShape.circle,
                          border: Border.all(color: peerColor),
                        ),
                        child: Center(
                          child: Text(
                            peer.handle.isNotEmpty ? peer.handle[0].toUpperCase() : '?',
                            style: const TextStyle(
                              color: Colors.black,
                              fontWeight: FontWeight.bold,
                              fontSize: 16,
                            ),
                          ),
                        ),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              peer.handle,
                              style: TextStyle(
                                color: peerColor,
                                fontSize: 16,
                                fontWeight: FontWeight.bold,
                                fontFamily: 'monospace',
                              ),
                            ),
                            Text(
                              peer.name,
                              style: const TextStyle(
                                color: Colors.white,
                                fontSize: 12,
                                fontFamily: 'monospace',
                              ),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 16),
                  
                  // Status info
                  Container(
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(
                      color: Colors.black.withValues(alpha: 0.3),
                      border: Border.all(color: peerColor.withValues(alpha: 0.3)),
                      borderRadius: BorderRadius.circular(4),
                    ),
                    child: Column(
                      children: [
                        _buildInfoRow('Type:', '${_getPeerTypeEmoji(peer.peerType)} ${peer.peerType.name.toUpperCase()}'),
                        _buildInfoRow('Status:', isConnected ? 'Connected' : 'Available'),
                        _buildInfoRow('Peer ID:', '${peer.id.substring(0, 8)}...'),
                      ],
                    ),
                  ),
                  const SizedBox(height: 16),
                  
                  // Action buttons
                  Column(
                    children: [
                      if (!isConnected)
                        TerminalButton(
                          text: 'CONNECT',
                          onPressed: () {
                            widget.onConnectPeer(peer.id);
                            setState(() => _selectedPeer = null);
                          },
                        ),
                      const SizedBox(height: 8),
                      TerminalButton(
                        text: 'OPEN CHAT',
                        onPressed: () {
                          widget.onUserSelect(peer);
                          setState(() => _selectedPeer = null);
                        },
                      ),
                      const SizedBox(height: 8),
                      TerminalButton(
                        text: 'PING USER',
                        onPressed: () {
                          // TODO: Implement ping functionality
                          setState(() => _selectedPeer = null);
                        },
                      ),
                      const SizedBox(height: 8),
                      TerminalButton(
                        text: 'CANCEL',
                        onPressed: () => setState(() => _selectedPeer = null),
                      ),
                    ],
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildInfoRow(String label, String value) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 2),
      child: Row(
        children: [
          SizedBox(
            width: 60,
            child: Text(
              label,
              style: const TextStyle(
                color: AppTheme.primaryGreen,
                fontSize: 10,
                fontFamily: 'monospace',
              ),
            ),
          ),
          Text(
            value,
            style: const TextStyle(
              color: Colors.white,
              fontSize: 10,
              fontFamily: 'monospace',
            ),
          ),
        ],
      ),
    );
  }

  void _showPeerInteraction(User peer) {
    setState(() {
      _selectedPeer = peer;
    });
  }

  Widget _buildPeerNode(User peer, bool isConnected) {
    Color nodeColor;
    
    switch (peer.peerType) {
      case PeerType.bluetooth:
        nodeColor = AppTheme.primaryGreen;
        break;
      case PeerType.wifi:
        nodeColor = Colors.cyan;
        break;
      case PeerType.real:
        nodeColor = Colors.red;
        break;
      case PeerType.mesh:
        // TODO: Handle this case.
        throw UnimplementedError();
    }

    return Container(
      width: 32,
      height: 32,
      decoration: BoxDecoration(
        color: isConnected ? nodeColor : AppTheme.surface,
        shape: BoxShape.circle,
        border: Border.all(
          color: isConnected ? nodeColor : AppTheme.darkGreen,
          width: 2,
        ),
        boxShadow: isConnected ? AppTheme.glowShadow(nodeColor) : null,
      ),
      child: Stack(
        children: [
          Center(
            child: Text(
              peer.handle.isNotEmpty ? peer.handle[0].toUpperCase() : '?',
              style: TextStyle(
                color: isConnected ? Colors.black : nodeColor,
                fontWeight: FontWeight.bold,
                fontSize: 12,
              ),
            ),
          ),
          if (isConnected)
            Positioned(
              top: -2,
              right: -2,
              child: Container(
                width: 8,
                height: 8,
                decoration: const BoxDecoration(
                  color: Colors.green,
                  shape: BoxShape.circle,
                ),
              ),
            ),
        ],
      ),
    );
  }

  Widget _buildPeerList() {
    if (widget.peers.isEmpty) {
      return Container(
        padding: const EdgeInsets.all(16),
        child: Text(
          widget.isDiscovering ? 'SCANNING_FOR_NODES...' : 'NO_PEERS_DETECTED',
          style: const TextStyle(
            color: AppTheme.darkGreen,
            fontSize: 10,
            letterSpacing: 2,
            fontFamily: 'monospace',
          ),
          textAlign: TextAlign.center,
        ),
      );
    }

    return ListView.builder(
      padding: const EdgeInsets.all(12),
      itemCount: widget.peers.length,
      itemBuilder: (context, index) {
        final peer = widget.peers[index];
        final isConnected = widget.connectedPeers.containsKey(peer.id);
        
        return Container(
          margin: const EdgeInsets.only(bottom: 8),
          padding: const EdgeInsets.all(12),
          decoration: BoxDecoration(
            color: AppTheme.surface,
            border: Border.all(
              color: isConnected ? AppTheme.primaryGreen : AppTheme.darkGreen,
            ),
          ),
          child: Row(
            children: [
              _buildPeerNode(peer, isConnected),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Text(
                          peer.handle,
                          style: const TextStyle(
                            color: AppTheme.handleOrange,
                            fontSize: 12,
                            fontWeight: FontWeight.bold,
                            fontFamily: 'monospace',
                          ),
                        ),
                        const SizedBox(width: 8),
                        Text(
                          _getPeerTypeEmoji(peer.peerType),
                          style: const TextStyle(fontSize: 10),
                        ),
                      ],
                    ),
                    const SizedBox(height: 4),
                    Text(
                      isConnected ? 'LINKED' : 'AVAILABLE',
                      style: TextStyle(
                        color: isConnected
                            ? AppTheme.primaryGreen
                            : AppTheme.darkGreen,
                        fontSize: 8,
                        letterSpacing: 1,
                        fontFamily: 'monospace',
                      ),
                    ),
                  ],
                ),
              ),
              Column(
                children: [
                  GestureDetector(
                    onTap: () {
                      if (isConnected) {
                        widget.onDisconnectPeer(peer.id);
                      } else {
                        widget.onConnectPeer(peer.id);
                      }
                    },
                    child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                      decoration: BoxDecoration(
                        color: isConnected ? AppTheme.primaryGreen : Colors.transparent,
                        border: Border.all(color: AppTheme.primaryGreen),
                      ),
                      child: Text(
                        isConnected ? 'DISCONNECT' : 'CONNECT',
                        style: TextStyle(
                          color: isConnected ? Colors.black : AppTheme.primaryGreen,
                          fontSize: 8,
                          fontWeight: FontWeight.bold,
                          fontFamily: 'monospace',
                        ),
                      ),
                    ),
                  ),
                  const SizedBox(height: 4),
                  GestureDetector(
                    onTap: () => widget.onUserSelect(peer),
                    child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                      decoration: BoxDecoration(
                        color: Colors.blue,
                        border: Border.all(color: Colors.blue),
                      ),
                      child: const Text(
                        'CHAT',
                        style: TextStyle(
                          color: Colors.white,
                          fontSize: 8,
                          fontWeight: FontWeight.bold,
                          fontFamily: 'monospace',
                        ),
                      ),
                    ),
                  ),
                ],
              ),
            ],
          ),
        );
      },
    );
  }

  String _getPeerTypeEmoji(PeerType type) {
    switch (type) {
      case PeerType.bluetooth:
        return '📡';
      case PeerType.wifi:
        return '📶';
      case PeerType.real:
        return '🔴';
      case PeerType.mesh:
        // TODO: Handle this case.
        throw UnimplementedError();
    }
  }
}
