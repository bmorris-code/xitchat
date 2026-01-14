import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'mesh_provider.dart';
import 'models.dart';

class MeshRadarView extends StatelessWidget {
  const MeshRadarView({super.key});

  @override
  Widget build(BuildContext context) {
    return Consumer<MeshProvider>(
      builder: (context, meshProvider, child) {
        return Scaffold(
          backgroundColor: Colors.black,
          appBar: AppBar(
            title: const Text(
              'geohash/radar',
              style: TextStyle(
                color: Colors.green,
                fontSize: 18,
                fontWeight: FontWeight.bold,
              ),
            ),
            backgroundColor: Colors.black,
            elevation: 0,
            actions: [
              IconButton(
                icon: const Icon(
                  Icons.grid_view,
                  color: Colors.green,
                ),
                onPressed: () {
                  // Toggle grid/list view
                },
              ),
              IconButton(
                icon: Icon(
                  meshProvider.isRealMode ? Icons.wifi_tethering : Icons.wifi,
                  color: meshProvider.isRealMode ? Colors.red : Colors.green,
                ),
                onPressed: () {
                  meshProvider.toggleMode();
                },
              ),
            ],
          ),
          body: Column(
            children: [
              // Status bar
              Container(
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  border:
                      Border(bottom: BorderSide(color: Colors.green.shade800)),
                ),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            'scanning zone #428F | SIGNAL: 85% | NODES: ${meshProvider.peers.length} | CHANNELS: 3',
                            style: TextStyle(
                              color: Colors.green.shade600,
                              fontSize: 10,
                            ),
                          ),
                          Text(
                            meshProvider.isRealMode
                                ? '🔴 REAL MODE'
                                : '🟢 SIMULATED MODE',
                            style: TextStyle(
                              color: meshProvider.isRealMode
                                  ? Colors.red
                                  : Colors.green,
                              fontSize: 8,
                              fontWeight: FontWeight.bold,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),

              // Radar grid
              Expanded(
                child: Container(
                  margin: const EdgeInsets.all(16),
                  decoration: BoxDecoration(
                    border: Border.all(color: Colors.green.shade800),
                    borderRadius: BorderRadius.circular(8),
                    color: Colors.black.withOpacity(0.05),
                  ),
                  child: Stack(
                    children: [
                      // Radar grid lines
                      CustomPaint(
                        size: Size.infinite,
                        painter: RadarGridPainter(),
                      ),

                      // Peers
                      ...meshProvider.peers.asMap().entries.map((entry) {
                        final index = entry.key;
                        final peer = entry.value;
                        final left = 0.2 + (index * 0.25) % 0.6;
                        final top = 0.15 + (index * 0.15) % 0.7;

                        return Positioned(
                          left: left,
                          top: top,
                          child: GestureDetector(
                            onTap: () {
                              _showPeerDetails(context, peer);
                            },
                            child: Column(
                              children: [
                                // Connection indicator
                                if (peer.isConnected)
                                  Container(
                                    width: 48,
                                    height: 48,
                                    decoration: BoxDecoration(
                                      color: Colors.red.withOpacity(0.1),
                                      shape: BoxShape.circle,
                                    ),
                                  ),

                                // Peer node
                                Container(
                                  width: 20,
                                  height: 20,
                                  decoration: BoxDecoration(
                                    border: Border.all(
                                        color: Colors.black, width: 2),
                                    borderRadius: BorderRadius.circular(4),
                                    color: peer.isConnected
                                        ? Colors.red.shade400
                                        : Colors.green,
                                    boxShadow: [
                                      BoxShadow(
                                        color: meshProvider.isRealMode
                                            ? Colors.red
                                            : Colors.green,
                                        blurRadius: 10,
                                        spreadRadius: 2,
                                      ),
                                    ],
                                  ),
                                ),

                                // Peer handle
                                Container(
                                  margin: const EdgeInsets.only(top: 4),
                                  padding: const EdgeInsets.symmetric(
                                      horizontal: 8, vertical: 2),
                                  decoration: BoxDecoration(
                                    border: Border.all(
                                      color: meshProvider.isRealMode
                                          ? Colors.red.withOpacity(0.5)
                                          : Colors.green.withOpacity(0.3),
                                    ),
                                    borderRadius: BorderRadius.circular(4),
                                    color: Colors.black.withOpacity(0.8),
                                  ),
                                  child: Text(
                                    '<${peer.handle}>',
                                    style: TextStyle(
                                      color: meshProvider.isRealMode
                                          ? Colors.red.shade400
                                          : Colors.green,
                                      fontSize: 9,
                                      fontWeight: FontWeight.bold,
                                    ),
                                  ),
                                ),
                              ],
                            ),
                          ),
                        );
                      }),

                      // You (center node)
                      Positioned(
                        left: 0.5,
                        top: 0.5,
                        child: Transform.translate(
                          offset: const Offset(-25, -25),
                          child: Column(
                            children: [
                              Container(
                                width: 48,
                                height: 48,
                                decoration: BoxDecoration(
                                  border:
                                      Border.all(color: Colors.cyan, width: 2),
                                  borderRadius: BorderRadius.circular(8),
                                ),
                                child: Transform.rotate(
                                  angle: 0.785398, // 45 degrees
                                  child: Container(
                                    width: 48,
                                    height: 48,
                                    decoration: BoxDecoration(
                                      border: Border.all(
                                          color: Colors.cyan, width: 1),
                                      borderRadius: BorderRadius.circular(8),
                                    ),
                                  ),
                                ),
                              ),
                              Container(
                                margin: const EdgeInsets.only(top: 8),
                                padding: const EdgeInsets.symmetric(
                                    horizontal: 8, vertical: 4),
                                decoration: BoxDecoration(
                                  border: Border.all(color: Colors.cyan),
                                  borderRadius: BorderRadius.circular(4),
                                  color: Colors.cyan.shade900,
                                ),
                                child: const Text(
                                  'You (Active Node)',
                                  style: TextStyle(
                                    color: Colors.white,
                                    fontSize: 8,
                                    fontWeight: FontWeight.bold,
                                  ),
                                ),
                              ),
                            ],
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ],
          ),
        );
      },
    );
  }

  void _showPeerDetails(BuildContext context, MeshPeer peer) {
    showDialog(
      context: context,
      builder: (BuildContext context) {
        return AlertDialog(
          backgroundColor: Colors.black,
          title: Text(
            peer.handle,
            style: const TextStyle(color: Colors.green),
          ),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text('Name: ${peer.name}'),
              Text('Status: ${peer.isConnected ? 'Connected' : 'Available'}'),
              Text('Method: ${peer.discoveryMethod}'),
              if (peer.signalStrength != null)
                Text('Signal: ${peer.signalStrength}%'),
              if (peer.distance != null) Text('Distance: ${peer.distance}m'),
            ],
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.of(context).pop(),
              child: const Text('Close'),
            ),
            if (!peer.isConnected)
              TextButton(
                onPressed: () {
                  Navigator.of(context).pop();
                  // Connect to peer
                },
                child: const Text('Connect'),
              ),
          ],
        );
      },
    );
  }
}

class RadarGridPainter extends CustomPainter {
  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()
      ..color = Colors.green.withOpacity(0.1)
      ..strokeWidth = 1;

    // Draw grid lines
    for (int i = 0; i <= 10; i++) {
      final x = (size.width / 10) * i;
      canvas.drawLine(Offset(x, 0), Offset(x, size.height), paint);
    }

    for (int i = 0; i <= 10; i++) {
      final y = (size.height / 10) * i;
      canvas.drawLine(Offset(0, y), Offset(size.width, y), paint);
    }

    // Draw circles
    final center = Offset(size.width / 2, size.height / 2);
    final circlePaint = Paint()
      ..color = Colors.green.withOpacity(0.05)
      ..strokeWidth = 1
      ..style = PaintingStyle.stroke;

    canvas.drawCircle(center, size.width * 0.15, circlePaint);
    canvas.drawCircle(center, size.width * 0.35, circlePaint);
    canvas.drawCircle(center, size.width * 0.55, circlePaint);
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}
