import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../providers/app_provider.dart';
import '../theme/app_theme.dart';

class GalleryView extends StatefulWidget {
  const GalleryView({super.key});

  @override
  State<GalleryView> createState() => _GalleryViewState();
}

class _GalleryViewState extends State<GalleryView> with TickerProviderStateMixin {
  late TabController _tabController;
  final List<GalleryItem> _galleryItems = [
    GalleryItem(
      id: '1',
      title: 'Mesh Network Visual',
      description: 'Real-time mesh topology visualization',
      imageUrl: 'https://picsum.photos/seed/mesh1/400/300',
      type: GalleryType.visualization,
      timestamp: DateTime.now().subtract(const Duration(hours: 2)),
      likes: 42,
      shares: 8,
    ),
    GalleryItem(
      id: '2',
      title: 'XC Economy Chart',
      description: 'Weekly XC token distribution',
      imageUrl: 'https://picsum.photos/seed/xc1/400/300',
      type: GalleryType.chart,
      timestamp: DateTime.now().subtract(const Duration(hours: 5)),
      likes: 28,
      shares: 12,
    ),
    GalleryItem(
      id: '3',
      title: 'Peer Connections',
      description: 'Active peer connections map',
      imageUrl: 'https://picsum.photos/seed/peers1/400/300',
      type: GalleryType.network,
      timestamp: DateTime.now().subtract(const Duration(days: 1)),
      likes: 35,
      shares: 6,
    ),
    GalleryItem(
      id: '4',
      title: 'Message Flow',
      description: 'Message routing visualization',
      imageUrl: 'https://picsum.photos/seed/flow1/400/300',
      type: GalleryType.visualization,
      timestamp: DateTime.now().subtract(const Duration(days: 2)),
      likes: 51,
      shares: 15,
    ),
  ];

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 3, vsync: this);
  }

  @override
  void dispose() {
    _tabController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Consumer<AppProvider>(
      builder: (context, appProvider, child) {
        return Scaffold(
          backgroundColor: AppTheme.background,
          appBar: AppBar(
            title: const Text('GALLERY'),
            backgroundColor: AppTheme.background,
            elevation: 0,
            bottom: TabBar(
              controller: _tabController,
              indicatorColor: AppTheme.primaryGreen,
              labelColor: AppTheme.primaryGreen,
              unselectedLabelColor: AppTheme.darkGreen,
              tabs: const [
                Tab(text: 'VISUALIZATIONS'),
                Tab(text: 'NETWORK'),
                Tab(text: 'SHARED'),
              ],
            ),
          ),
          body: TabBarView(
            controller: _tabController,
            children: [
              _buildVisualizationsTab(),
              _buildNetworkTab(),
              _buildSharedTab(),
            ],
          ),
          floatingActionButton: FloatingActionButton(
            onPressed: _showAddItemDialog,
            backgroundColor: AppTheme.primaryGreen,
            child: const Icon(Icons.add, color: Colors.black),
          ),
        );
      },
    );
  }

  Widget _buildVisualizationsTab() {
    final visualizations = _galleryItems.where((item) => item.type == GalleryType.visualization).toList();
    
    return GridView.builder(
      padding: const EdgeInsets.all(16),
      gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
        crossAxisCount: 2,
        crossAxisSpacing: 16,
        mainAxisSpacing: 16,
        childAspectRatio: 0.8,
      ),
      itemCount: visualizations.length,
      itemBuilder: (context, index) {
        return _buildGalleryCard(visualizations[index]);
      },
    );
  }

  Widget _buildNetworkTab() {
    final networkItems = _galleryItems.where((item) => item.type == GalleryType.network || item.type == GalleryType.chart).toList();
    
    return GridView.builder(
      padding: const EdgeInsets.all(16),
      gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
        crossAxisCount: 2,
        crossAxisSpacing: 16,
        mainAxisSpacing: 16,
        childAspectRatio: 0.8,
      ),
      itemCount: networkItems.length,
      itemBuilder: (context, index) {
        return _buildGalleryCard(networkItems[index]);
      },
    );
  }

  Widget _buildSharedTab() {
    return ListView.builder(
      padding: const EdgeInsets.all(16),
      itemCount: _galleryItems.length,
      itemBuilder: (context, index) {
        return _buildSharedListItem(_galleryItems[index]);
      },
    );
  }

  Widget _buildGalleryCard(GalleryItem item) {
    return GestureDetector(
      onTap: () => _showItemDetails(item),
      child: Container(
        decoration: BoxDecoration(
          border: Border.all(color: AppTheme.darkGreen, width: 1),
          borderRadius: BorderRadius.circular(12),
          color: Colors.black.withOpacity(0.3),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Expanded(
              flex: 3,
              child: Container(
                width: double.infinity,
                decoration: BoxDecoration(
                  borderRadius: const BorderRadius.vertical(top: Radius.circular(12)),
                  image: DecorationImage(
                    image: NetworkImage(item.imageUrl),
                    fit: BoxFit.cover,
                  ),
                ),
              ),
            ),
            Expanded(
              flex: 2,
              child: Padding(
                padding: const EdgeInsets.all(12),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      item.title,
                      style: const TextStyle(
                        color: Colors.white,
                        fontSize: 14,
                        fontWeight: FontWeight.bold,
                      ),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                    const SizedBox(height: 4),
                    Text(
                      item.description,
                      style: TextStyle(
                        color: AppTheme.darkGreen.withOpacity(0.8),
                        fontSize: 10,
                      ),
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                    ),
                    const Spacer(),
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Row(
                          children: [
                            Icon(
                              Icons.favorite,
                              color: Colors.red,
                              size: 12,
                            ),
                            const SizedBox(width: 4),
                            Text(
                              '${item.likes}',
                              style: TextStyle(
                                color: AppTheme.darkGreen,
                                fontSize: 10,
                              ),
                            ),
                          ],
                        ),
                        Row(
                          children: [
                            Icon(
                              Icons.share,
                              color: AppTheme.primaryGreen,
                              size: 12,
                            ),
                            const SizedBox(width: 4),
                            Text(
                              '${item.shares}',
                              style: TextStyle(
                                color: AppTheme.darkGreen,
                                fontSize: 10,
                              ),
                            ),
                          ],
                        ),
                      ],
                    ),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildSharedListItem(GalleryItem item) {
    return Container(
      margin: const EdgeInsets.only(bottom: 16),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        border: Border.all(color: AppTheme.darkGreen, width: 1),
        borderRadius: BorderRadius.circular(12),
      ),
      child: Row(
        children: [
          Container(
            width: 80,
            height: 80,
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(8),
              image: DecorationImage(
                image: NetworkImage(item.imageUrl),
                fit: BoxFit.cover,
              ),
            ),
          ),
          const SizedBox(width: 16),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  item.title,
                  style: const TextStyle(
                    color: Colors.white,
                    fontSize: 16,
                    fontWeight: FontWeight.bold,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  item.description,
                  style: TextStyle(
                    color: AppTheme.darkGreen.withOpacity(0.8),
                    fontSize: 12,
                  ),
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                ),
                const SizedBox(height: 8),
                Row(
                  children: [
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                      decoration: BoxDecoration(
                        color: AppTheme.primaryGreen.withOpacity(0.2),
                        borderRadius: BorderRadius.circular(8),
                      ),
                      child: Text(
                        item.type.name.toUpperCase(),
                        style: const TextStyle(
                          color: AppTheme.primaryGreen,
                          fontSize: 8,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                    ),
                    const Spacer(),
                    Text(
                      _formatTimestamp(item.timestamp),
                      style: TextStyle(
                        color: AppTheme.darkGreen.withOpacity(0.6),
                        fontSize: 10,
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  void _showItemDetails(GalleryItem item) {
    showDialog(
      context: context,
      builder: (context) => Dialog(
        backgroundColor: AppTheme.background,
        child: Container(
          padding: const EdgeInsets.all(20),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text(
                    item.title,
                    style: const TextStyle(
                      color: Colors.white,
                      fontSize: 20,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                  IconButton(
                    onPressed: () => Navigator.pop(context),
                    icon: const Icon(Icons.close, color: AppTheme.darkGreen),
                  ),
                ],
              ),
              const SizedBox(height: 16),
              Container(
                width: double.infinity,
                height: 200,
                decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(12),
                  image: DecorationImage(
                    image: NetworkImage(item.imageUrl),
                    fit: BoxFit.cover,
                  ),
                ),
              ),
              const SizedBox(height: 16),
              Text(
                item.description,
                style: TextStyle(
                  color: AppTheme.darkGreen.withOpacity(0.8),
                  fontSize: 14,
                ),
              ),
              const SizedBox(height: 16),
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceAround,
                children: [
                  _buildActionButton(Icons.favorite, '${item.likes}', Colors.red),
                  _buildActionButton(Icons.share, '${item.shares}', AppTheme.primaryGreen),
                  _buildActionButton(Icons.download, 'SAVE', AppTheme.darkGreen),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildActionButton(IconData icon, String label, Color color) {
    return Column(
      children: [
        Container(
          width: 48,
          height: 48,
          decoration: BoxDecoration(
            color: color.withOpacity(0.2),
            borderRadius: BorderRadius.circular(24),
          ),
          child: Icon(
            icon,
            color: color,
            size: 24,
          ),
        ),
        const SizedBox(height: 8),
        Text(
          label,
          style: TextStyle(
            color: color,
            fontSize: 12,
            fontWeight: FontWeight.bold,
          ),
        ),
      ],
    );
  }

  void _showAddItemDialog() {
    showDialog(
      context: context,
      builder: (context) => Dialog(
        backgroundColor: AppTheme.background,
        child: Container(
          padding: const EdgeInsets.all(20),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Text(
                'ADD TO GALLERY',
                style: TextStyle(
                  color: AppTheme.primaryGreen,
                  fontSize: 18,
                  fontWeight: FontWeight.bold,
                  letterSpacing: 2,
                ),
              ),
              const SizedBox(height: 20),
              _buildAddOption('Network Visualization', Icons.hub),
              _buildAddOption('XC Chart', Icons.bar_chart),
              _buildAddOption('Peer Map', Icons.map),
              _buildAddOption('Message Flow', Icons.swap_horiz),
              const SizedBox(height: 20),
              SizedBox(
                width: double.infinity,
                child: ElevatedButton(
                  onPressed: () => Navigator.pop(context),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: AppTheme.primaryGreen,
                    foregroundColor: Colors.black,
                  ),
                  child: const Text('CANCEL'),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildAddOption(String title, IconData icon) {
    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        border: Border.all(color: AppTheme.darkGreen, width: 1),
        borderRadius: BorderRadius.circular(12),
      ),
      child: Row(
        children: [
          Container(
            width: 40,
            height: 40,
            decoration: BoxDecoration(
              color: AppTheme.primaryGreen.withOpacity(0.2),
              borderRadius: BorderRadius.circular(20),
            ),
            child: Icon(
              icon,
              color: AppTheme.primaryGreen,
              size: 20,
            ),
          ),
          const SizedBox(width: 16),
          Expanded(
            child: Text(
              title,
              style: const TextStyle(
                color: Colors.white,
                fontSize: 16,
                fontWeight: FontWeight.bold,
              ),
            ),
          ),
          const Icon(
            Icons.arrow_forward_ios,
            color: AppTheme.darkGreen,
            size: 16,
          ),
        ],
      ),
    );
  }

  String _formatTimestamp(DateTime timestamp) {
    final now = DateTime.now();
    final difference = now.difference(timestamp);
    
    if (difference.inDays > 0) {
      return '${difference.inDays}d ago';
    } else if (difference.inHours > 0) {
      return '${difference.inHours}h ago';
    } else if (difference.inMinutes > 0) {
      return '${difference.inMinutes}m ago';
    } else {
      return 'Just now';
    }
  }
}

enum GalleryType {
  visualization,
  network,
  chart,
  shared,
}

class GalleryItem {
  final String id;
  final String title;
  final String description;
  final String imageUrl;
  final GalleryType type;
  final DateTime timestamp;
  final int likes;
  final int shares;

  GalleryItem({
    required this.id,
    required this.title,
    required this.description,
    required this.imageUrl,
    required this.type,
    required this.timestamp,
    required this.likes,
    required this.shares,
  });
}
