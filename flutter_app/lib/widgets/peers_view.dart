import 'package:flutter/material.dart';
import '../models/chat.dart';

class PeersView extends StatelessWidget {
  final List<User> peers;
  final Map<String, User> connectedPeers;
  final bool isRealMode;
  final Function(String) onConnectPeer;
  final Function(String) onDisconnectPeer;

  const PeersView({
    super.key,
    required this.peers,
    required this.connectedPeers,
    required this.isRealMode,
    required this.onConnectPeer,
    required this.onDisconnectPeer,
  });

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.black,
      appBar: AppBar(
        title: const Text(
          'P2P Peers',
          style: TextStyle(color: Colors.green),
        ),
        backgroundColor: Colors.black,
        elevation: 0,
      ),
      body: peers.isEmpty
          ? Center(
              child: Text(
                'No peers found.\nEnable REAL mode to discover nearby devices.',
                textAlign: TextAlign.center,
                style: TextStyle(
                  color: Colors.green.shade600,
                  fontSize: 16,
                ),
              ),
            )
          : ListView.builder(
              itemCount: peers.length,
              itemBuilder: (context, index) {
                final peer = peers[index];
                return Container(
                  margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                  padding: const EdgeInsets.all(16),
                  decoration: BoxDecoration(
                    border: Border.all(
                      color: isRealMode ? Colors.red.shade400 : Colors.green.shade400,
                    ),
                    borderRadius: BorderRadius.circular(8),
                    color: Colors.black.withOpacity(0.8),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          Container(
                            width: 12,
                            height: 12,
                            decoration: BoxDecoration(
                              color: peer.isConnected ? Colors.green : Colors.red.shade600,
                              shape: BoxShape.circle,
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
                                    color: isRealMode ? Colors.red.shade400 : Colors.green.shade400,
                                    fontSize: 16,
                                    fontWeight: FontWeight.bold,
                                  ),
                                ),
                                Text(
                                  peer.name,
                                  style: TextStyle(
                                    color: Colors.white.withOpacity(0.7),
                                    fontSize: 14,
                                  ),
                                ),
                              ],
                            ),
                          ),
                          if (!peer.isConnected)
                            ElevatedButton(
                              onPressed: () => onConnectPeer(peer.id),
                              style: ElevatedButton.styleFrom(
                                backgroundColor: isRealMode ? Colors.red.shade600 : Colors.green.shade600,
                                foregroundColor: Colors.white,
                              ),
                              child: const Text('Connect'),
                            ),
                        ],
                      ),
                    ],
                  ),
                );
              },
            ),
    );
  }
}
