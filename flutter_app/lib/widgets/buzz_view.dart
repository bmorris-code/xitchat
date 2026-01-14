import 'package:flutter/material.dart';
import '../theme/app_theme.dart';
import '../xc_economy.dart';
import '../models/buzz.dart';
import 'terminal_components.dart';

class BuzzView extends StatefulWidget {
  final VoidCallback? onBack;

  const BuzzView({
    super.key,
    this.onBack,
  });

  @override
  State<BuzzView> createState() => _BuzzViewState();
}

class _BuzzViewState extends State<BuzzView> {
  final TextEditingController _searchController = TextEditingController();
  final TextEditingController _newBuzzController = TextEditingController();
  
  List<BuzzItem> _buzzItems = [];
  List<BuzzItem> _filteredItems = [];
  bool _isLoading = false;
  String _selectedFilter = 'ALL';

  @override
  void initState() {
    super.initState();
    _loadBuzzItems();
    _searchController.addListener(_filterItems);
  }

  @override
  void dispose() {
    _searchController.dispose();
    _newBuzzController.dispose();
    super.dispose();
  }

  void _loadBuzzItems() {
    setState(() => _isLoading = true);
    
    // Simulate loading buzz items
    Future.delayed(const Duration(milliseconds: 500), () {
      final demoItems = [
        BuzzItem(
          id: 'demo-1',
          title: 'Live Intelligence Feed Active',
          time: 'now',
          snippet: 'Real-time cybersecurity and mesh network intelligence monitoring enabled.',
          category: 'UPDATE',
          userName: 'XitChat Core',
          userHandle: '@core',
          userAvatar: 'https://picsum.photos/seed/core/200',
          distance: '0.0km',
          likes: 12,
          comments: 0,
          isLiked: false,
        ),
        BuzzItem(
          id: 'demo-2',
          title: 'Local Event Tonight',
          time: '1h ago',
          snippet: 'Mesh networking meetup at usual spot. Bring your devices!',
          category: 'NEWS',
          userName: 'NodeMaster',
          userHandle: '@nodemaster',
          userAvatar: 'https://picsum.photos/seed/nodemaster/200',
          distance: '2.3km',
          likes: 8,
          comments: 3,
          isLiked: false,
        ),
        BuzzItem(
          id: 'demo-3',
          title: 'Security Update Available',
          time: '2h ago',
          snippet: 'New encryption protocols deployed across the mesh network.',
          category: 'UPDATE',
          userName: 'SecurityBot',
          userHandle: '@secbot',
          userAvatar: 'https://picsum.photos/seed/secbot/200',
          distance: '0.0km',
          likes: 24,
          comments: 5,
          isLiked: true,
        ),
      ];
      
      setState(() {
        _buzzItems = demoItems;
        _filteredItems = demoItems;
        _isLoading = false;
      });
    });
  }

  void _filterItems() {
    final query = _searchController.text.toLowerCase();
    setState(() {
      _filteredItems = _buzzItems.where((item) {
        final matchesSearch = query.isEmpty ||
            item.title.toLowerCase().contains(query) ||
            item.snippet.toLowerCase().contains(query) ||
            item.userHandle.toLowerCase().contains(query);
        
        final matchesFilter = _selectedFilter == 'ALL' ||
            item.category == _selectedFilter;
        
        return matchesSearch && matchesFilter;
      }).toList();
    });
  }

  void _toggleLike(String itemId) {
    setState(() {
      final item = _buzzItems.firstWhere((item) => item.id == itemId);
      item.isLiked = !item.isLiked;
      item.likes += item.isLiked ? 1 : -1;
      _filterItems();
    });

    // Award XC for engagement
    if (_buzzItems.firstWhere((item) => item.id == itemId).isLiked) {
      xcEconomy.addXC(1, 'Liked a buzz post', 'buzz');
    }
  }

  void _showPostDialog() {
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        backgroundColor: AppTheme.surface,
        title: const GlowText(text: 'NEW_BROADCAST'),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            TextField(
              controller: _newBuzzController,
              style: const TextStyle(color: Colors.white, fontFamily: 'monospace'),
              decoration: const InputDecoration(
                hintText: 'Enter your buzz...',
                hintStyle: TextStyle(color: AppTheme.primaryGreen),
                border: OutlineInputBorder(
                  borderSide: BorderSide(color: AppTheme.primaryGreen),
                ),
                enabledBorder: OutlineInputBorder(
                  borderSide: BorderSide(color: AppTheme.primaryGreen),
                ),
                focusedBorder: OutlineInputBorder(
                  borderSide: BorderSide(color: AppTheme.primaryGreen),
                ),
              ),
              maxLines: 3,
              maxLength: 280,
            ),
            const SizedBox(height: 16),
            DropdownButtonFormField<String>(
              initialValue: _selectedFilter,
              dropdownColor: AppTheme.surface,
              decoration: const InputDecoration(
                labelText: 'Category',
                labelStyle: TextStyle(color: AppTheme.primaryGreen),
                border: OutlineInputBorder(
                  borderSide: BorderSide(color: AppTheme.primaryGreen),
                ),
                enabledBorder: OutlineInputBorder(
                  borderSide: BorderSide(color: AppTheme.primaryGreen),
                ),
                focusedBorder: OutlineInputBorder(
                  borderSide: BorderSide(color: AppTheme.primaryGreen),
                ),
              ),
              items: ['ALL', 'NEWS', 'GOSSIP', 'UPDATE', 'AD']
                  .map((category) => DropdownMenuItem(
                        value: category,
                        child: Text(
                          category,
                          style: const TextStyle(color: Colors.white, fontFamily: 'monospace'),
                        ),
                      ))
                  .toList(),
              onChanged: (value) => setState(() => _selectedFilter = value ?? 'ALL'),
            ),
          ],
        ),
        actions: [
          TerminalButton(
            text: 'CANCEL',
            onPressed: () => Navigator.pop(context),
          ),
          TerminalButton(
            text: 'BROADCAST',
            onPressed: () {
              if (_newBuzzController.text.isNotEmpty) {
                _postBuzz();
                Navigator.pop(context);
              }
            },
          ),
        ],
      ),
    );
  }

  void _postBuzz() {
    final newBuzz = BuzzItem(
      id: 'buzz-${DateTime.now().millisecondsSinceEpoch}',
      title: _newBuzzController.text.length > 50
          ? '${_newBuzzController.text.substring(0, 50)}...'
          : _newBuzzController.text,
      time: 'now',
      snippet: _newBuzzController.text,
      category: _selectedFilter,
      userName: 'You',
      userHandle: '@you',
      userAvatar: 'https://picsum.photos/seed/you/200',
      distance: '0.0km',
      likes: 0,
      comments: 0,
      isLiked: false,
    );

    setState(() {
      _buzzItems.insert(0, newBuzz);
      _filterItems();
    });

    // Award XC for posting
    xcEconomy.addXC(5, 'Posted to buzz', 'buzz');
    _newBuzzController.clear();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppTheme.background,
      appBar: AppBar(
        backgroundColor: AppTheme.background,
        elevation: 0,
        leading: widget.onBack != null
            ? IconButton(
                icon: const Icon(Icons.arrow_back, color: AppTheme.primaryGreen),
                onPressed: widget.onBack,
              )
            : null,
        title: const Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            GlowText(text: 'the_buzz.bin', fontSize: 20),
            Text(
              'local_intelligence_feed',
              style: TextStyle(
                color: AppTheme.primaryGreen,
                fontSize: 10,
                fontFamily: 'monospace',
              ),
            ),
          ],
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.add, color: AppTheme.primaryGreen),
            onPressed: _showPostDialog,
          ),
        ],
      ),
      body: Column(
        children: [
          // Search and Filter
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              border: Border(
                bottom: BorderSide(color: AppTheme.primaryGreen.withAlpha((0.2 * 255).round())),
              ),
            ),
            child: Column(
              children: [
                // Search Bar
                TextField(
                  controller: _searchController,
                  style: const TextStyle(color: Colors.white, fontFamily: 'monospace'),
                  decoration: const InputDecoration(
                    hintText: 'search_intelligence...',
                    hintStyle: TextStyle(color: AppTheme.primaryGreen),
                    prefixIcon: Icon(Icons.search, color: AppTheme.primaryGreen),
                    border: OutlineInputBorder(
                      borderSide: BorderSide(color: AppTheme.primaryGreen),
                    ),
                    enabledBorder: OutlineInputBorder(
                      borderSide: BorderSide(color: AppTheme.primaryGreen),
                    ),
                    focusedBorder: OutlineInputBorder(
                      borderSide: BorderSide(color: AppTheme.primaryGreen),
                    ),
                  ),
                ),
                const SizedBox(height: 12),
                // Filter Chips
                SingleChildScrollView(
                  scrollDirection: Axis.horizontal,
                  child: Row(
                    children: ['ALL', 'NEWS', 'GOSSIP', 'UPDATE', 'AD'].map((filter) {
                      final isSelected = _selectedFilter == filter;
                      return Padding(
                        padding: const EdgeInsets.only(right: 8),
                        child: FilterChip(
                          label: Text(
                            filter,
                            style: TextStyle(
                              color: isSelected ? Colors.black : AppTheme.primaryGreen,
                              fontSize: 10,
                              fontFamily: 'monospace',
                              fontWeight: FontWeight.bold,
                            ),
                          ),
                          selected: isSelected,
                          onSelected: (selected) {
                            setState(() {
                              _selectedFilter = filter;
                              _filterItems();
                            });
                          },
                          backgroundColor: Colors.transparent,
                          selectedColor: AppTheme.primaryGreen,
                          checkmarkColor: Colors.black,
                          side: const BorderSide(color: AppTheme.primaryGreen),
                        ),
                      );
                    }).toList(),
                  ),
                ),
              ],
            ),
          ),
          
          // Buzz Items
          Expanded(
            child: _isLoading
                ? const Center(
                    child: CircularProgressIndicator(color: AppTheme.primaryGreen),
                  )
                : _filteredItems.isEmpty
                    ? Center(
                        child: Column(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            const Icon(
                              Icons.rss_feed,
                              size: 64,
                              color: AppTheme.primaryGreen,
                            ),
                            const SizedBox(height: 16),
                            const Text(
                              'NO_SIGNAL_DETECTED',
                              style: TextStyle(
                                color: AppTheme.primaryGreen,
                                fontSize: 16,
                                fontFamily: 'monospace',
                                fontWeight: FontWeight.bold,
                              ),
                            ),
                            const SizedBox(height: 8),
                            Text(
                              'No buzz items found',
                              style: TextStyle(
                                color: AppTheme.primaryGreen.withAlpha((0.6 * 255).round()),
                                fontSize: 12,
                                fontFamily: 'monospace',
                              ),
                            ),
                          ],
                        ),
                      )
                    : ListView.builder(
                        padding: const EdgeInsets.all(16),
                        itemCount: _filteredItems.length,
                        itemBuilder: (context, index) {
                          final item = _filteredItems[index];
                          return _buildBuzzCard(item);
                        },
                      ),
          ),
        ],
      ),
    );
  }

  Widget _buildBuzzCard(BuzzItem item) {
    return Container(
      margin: const EdgeInsets.only(bottom: 16),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppTheme.surface,
        border: Border.all(color: AppTheme.primaryGreen.withAlpha((0.2 * 255).round())),
        borderRadius: BorderRadius.circular(8),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // User Info
          Row(
            children: [
              Container(
                width: 40,
                height: 40,
                decoration: BoxDecoration(
                  color: AppTheme.primaryGreen.withAlpha((0.1 * 255).round()),
                  borderRadius: BorderRadius.circular(20),
                  border: Border.all(color: AppTheme.primaryGreen),
                ),
                child: const Icon(
                  Icons.person,
                  color: AppTheme.primaryGreen,
                  size: 20,
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Text(
                          item.userName,
                          style: const TextStyle(
                            color: Colors.white,
                            fontSize: 14,
                            fontWeight: FontWeight.bold,
                            fontFamily: 'monospace',
                          ),
                        ),
                        const SizedBox(width: 8),
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                          decoration: BoxDecoration(
                            color: _getCategoryColor(item.category),
                            borderRadius: BorderRadius.circular(4),
                          ),
                          child: Text(
                            item.category,
                            style: const TextStyle(
                              color: Colors.black,
                              fontSize: 8,
                              fontWeight: FontWeight.bold,
                              fontFamily: 'monospace',
                            ),
                          ),
                        ),
                      ],
                    ),
                    Row(
                      children: [
                        Text(
                          item.userHandle,
                          style: TextStyle(
                            color: AppTheme.primaryGreen.withAlpha((0.7 * 255).round()),
                            fontSize: 12,
                            fontFamily: 'monospace',
                          ),
                        ),
                        const SizedBox(width: 8),
                        Text(
                          '• ${item.distance}',
                          style: TextStyle(
                            color: AppTheme.primaryGreen.withAlpha((0.5 * 255).round()),
                            fontSize: 10,
                            fontFamily: 'monospace',
                          ),
                        ),
                        const SizedBox(width: 8),
                        Text(
                          '• ${item.time}',
                          style: TextStyle(
                            color: AppTheme.primaryGreen.withAlpha((0.5 * 255).round()),
                            fontSize: 10,
                            fontFamily: 'monospace',
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
            ],
          ),
          
          const SizedBox(height: 12),
          
          // Content
          Text(
            item.title,
            style: const TextStyle(
              color: Colors.white,
              fontSize: 16,
              fontWeight: FontWeight.bold,
              fontFamily: 'monospace',
            ),
          ),
          const SizedBox(height: 8),
          Text(
            item.snippet,
            style: TextStyle(
              color: AppTheme.primaryGreen.withAlpha((0.8 * 255).round()),
              fontSize: 14,
              fontFamily: 'monospace',
            ),
          ),
          
          const SizedBox(height: 12),
          
          // Actions
          Row(
            children: [
              GestureDetector(
                onTap: () => _toggleLike(item.id),
                child: Row(
                  children: [
                    Icon(
                      item.isLiked ? Icons.favorite : Icons.favorite_border,
                      color: item.isLiked ? Colors.red : AppTheme.primaryGreen,
                      size: 16,
                    ),
                    const SizedBox(width: 4),
                    Text(
                      item.likes.toString(),
                      style: const TextStyle(
                        color: AppTheme.primaryGreen,
                        fontSize: 12,
                        fontFamily: 'monospace',
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(width: 16),
              Row(
                children: [
                  const Icon(
                    Icons.comment,
                    color: AppTheme.primaryGreen,
                    size: 16,
                  ),
                  const SizedBox(width: 4),
                  Text(
                    item.comments.toString(),
                    style: const TextStyle(
                      color: AppTheme.primaryGreen,
                      fontSize: 12,
                      fontFamily: 'monospace',
                    ),
                  ),
                ],
              ),
              const Spacer(),
              Icon(
                Icons.share,
                color: AppTheme.primaryGreen.withAlpha((0.6 * 255).round()),
                size: 16,
              ),
            ],
          ),
        ],
      ),
    );
  }

  Color _getCategoryColor(String category) {
    switch (category) {
      case 'NEWS':
        return Colors.blue;
      case 'GOSSIP':
        return Colors.purple;
      case 'UPDATE':
        return Colors.orange;
      case 'AD':
        return Colors.red;
      default:
        return AppTheme.primaryGreen;
    }
  }
}
