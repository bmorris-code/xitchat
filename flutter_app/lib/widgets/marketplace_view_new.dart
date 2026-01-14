import 'package:flutter/material.dart';
import '../theme/app_theme.dart';
import '../xc_economy.dart';
import '../models/marketplace.dart';
import 'terminal_components.dart';

class MarketplaceView extends StatefulWidget {
  final VoidCallback? onBack;
  final Function(String)? onContact;

  const MarketplaceView({
    super.key,
    this.onBack,
    this.onContact,
  });

  @override
  State<MarketplaceView> createState() => _MarketplaceViewState();
}

class _MarketplaceViewState extends State<MarketplaceView> {
  final TextEditingController _searchController = TextEditingController();
  final TextEditingController _titleController = TextEditingController();
  final TextEditingController _descriptionController = TextEditingController();
  final TextEditingController _priceController = TextEditingController();
  
  String _selectedFilter = 'ALL';
  List<MarketplaceListing> _listings = [];
  List<MarketplaceListing> _filteredListings = [];
  bool _isLoading = false;

  @override
  void initState() {
    super.initState();
    _loadListings();
    _searchController.addListener(_filterListings);
  }

  @override
  void dispose() {
    _searchController.dispose();
    _titleController.dispose();
    _descriptionController.dispose();
    _priceController.dispose();
    super.dispose();
  }

  void _loadListings() {
    setState(() => _isLoading = true);
    
    // Simulate loading marketplace listings
    Future.delayed(const Duration(milliseconds: 500), () {
      final demoListings = [
        MarketplaceListing(
          id: 'l1',
          title: 'Vintage Gameboy Color',
          price: '450 XC',
          sellerHandle: '@retro_king',
          timestamp: DateTime.now().millisecondsSinceEpoch - 3600000,
          category: 'HAVE',
          description: 'Purple edition, works perfectly. No scratches.',
          location: 'Sector 428F',
        ),
        MarketplaceListing(
          id: 'l2',
          title: 'Need Math Tutor',
          price: 'Negotiable',
          sellerHandle: '@student_x',
          timestamp: DateTime.now().millisecondsSinceEpoch - 7200000,
          category: 'WANT',
          description: 'Help with Calculus 2. Can pay in XC or Moola.',
        ),
        MarketplaceListing(
          id: 'l3',
          title: 'Bike Repair Service',
          price: '50 XC/hr',
          sellerHandle: '@spoke_master',
          timestamp: DateTime.now().millisecondsSinceEpoch - 14400000,
          category: 'SERVICE',
          description: 'Available weekends for tune-ups and flat fixes.',
        ),
        MarketplaceListing(
          id: 'l4',
          title: 'Node Meetup: Central Park',
          price: 'FREE',
          sellerHandle: '@admin_node',
          timestamp: DateTime.now().millisecondsSinceEpoch - 1800000,
          category: 'EVENT',
          description: 'Saturday @ 2PM. Come chat offline and trade skins!',
          location: 'Sector 428F',
        ),
      ];
      
      setState(() {
        _listings = demoListings;
        _filterListings();
        _isLoading = false;
      });
    });
  }

  void _filterListings() {
    final query = _searchController.text.toLowerCase();
    setState(() {
      _filteredListings = _listings.where((listing) {
        final matchesSearch = query.isEmpty ||
            listing.title.toLowerCase().contains(query) ||
            listing.description.toLowerCase().contains(query) ||
            listing.sellerHandle.toLowerCase().contains(query);
        
        final matchesFilter = _selectedFilter == 'ALL' ||
            listing.category == _selectedFilter;
        
        return matchesSearch && matchesFilter;
      }).toList();
    });
  }

  void _showPostDialog() {
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        backgroundColor: AppTheme.surface,
        title: const GlowText(text: 'NEW_BROADCAST'),
        content: SingleChildScrollView(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              TextField(
                controller: _titleController,
                style: const TextStyle(color: Colors.white, fontFamily: 'monospace'),
                decoration: const InputDecoration(
                  labelText: 'Title',
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
              ),
              const SizedBox(height: 16),
              TextField(
                controller: _descriptionController,
                style: const TextStyle(color: Colors.white, fontFamily: 'monospace'),
                decoration: const InputDecoration(
                  labelText: 'Description',
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
                maxLines: 3,
              ),
              const SizedBox(height: 16),
              TextField(
                controller: _priceController,
                style: const TextStyle(color: Colors.white, fontFamily: 'monospace'),
                decoration: const InputDecoration(
                  labelText: 'Price',
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
                items: ['ALL', 'HAVE', 'WANT', 'SERVICE', 'EVENT']
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
        ),
        actions: [
          TerminalButton(
            text: 'CANCEL',
            onPressed: () => Navigator.pop(context), 
          ),
          TerminalButton(
            text: 'BROADCAST',
            onPressed: () {
              if (_titleController.text.isNotEmpty && _descriptionController.text.isNotEmpty) {
                _postListing();
                Navigator.pop(context);
              }
            },
          ),
        ],
      ),
    );
  }

  void _postListing() {
    final newListing = MarketplaceListing(
      id: 'listing-${DateTime.now().millisecondsSinceEpoch}',
      title: _titleController.text,
      price: _priceController.text.isNotEmpty ? _priceController.text : 'Negotiable',
      sellerHandle: '@you',
      timestamp: DateTime.now().millisecondsSinceEpoch,
      category: _selectedFilter,
      description: _descriptionController.text,
    );

    setState(() {
      _listings.insert(0, newListing);
      _filterListings();
    });

    // Clear form
    _titleController.clear();
    _descriptionController.clear();
    _priceController.clear();

    // Award XC for posting
    xcEconomy.addXC(3, 'Posted to marketplace', 'marketplace');
  }

  void _contactSeller(String handle) {
    widget.onContact?.call(handle);
  }

  String _formatTime(int timestamp) {
    final now = DateTime.now();
    final time = DateTime.fromMillisecondsSinceEpoch(timestamp);
    final difference = now.difference(time);
    
    if (difference.inMinutes < 60) {
      return '${difference.inMinutes}m ago';
    } else if (difference.inHours < 24) {
      return '${difference.inHours}h ago';
    } else {
      return '${difference.inDays}d ago';
    }
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
            GlowText(text: 'local_trade.bbs', fontSize: 20),
            Text(
              'community_bulletin_board_v4',
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
                    hintText: 'search_listings...',
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
                    children: ['ALL', 'HAVE', 'WANT', 'SERVICE', 'EVENT'].map((filter) {
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
                              _filterListings();
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
          
          // Listings
          Expanded(
            child: _isLoading
                ? const Center(
                    child: CircularProgressIndicator(color: AppTheme.primaryGreen),
                  )
                : _filteredListings.isEmpty
                    ? Center(
                        child: Column(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            const Icon(
                              Icons.store,
                              size: 64,
                              color: AppTheme.primaryGreen,
                            ),
                            const SizedBox(height: 16),
                            const Text(
                              'NO_LISTINGS_FOUND',
                              style: TextStyle(
                                color: AppTheme.primaryGreen,
                                fontSize: 16,
                                fontFamily: 'monospace',
                                fontWeight: FontWeight.bold,
                              ),
                            ),
                            const SizedBox(height: 8),
                            Text(
                              'No marketplace listings found',
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
                        itemCount: _filteredListings.length,
                        itemBuilder: (context, index) {
                          final listing = _filteredListings[index];
                          return _buildListingCard(listing);
                        },
                      ),
          ),
        ],
      ),
    );
  }

  Widget _buildListingCard(MarketplaceListing listing) {
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
          // Header with category and price
          Row(
            children: [
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                decoration: BoxDecoration(
                  color: _getCategoryColor(listing.category),
                  borderRadius: BorderRadius.circular(4),
                ),
                child: Text(
                  listing.category,
                  style: const TextStyle(
                    color: Colors.black,
                    fontSize: 8,
                    fontWeight: FontWeight.bold,
                    fontFamily: 'monospace',
                  ),
                ),
              ),
              const Spacer(),
              Text(
                listing.price,
                style: const TextStyle(
                  color: Colors.amber,
                  fontSize: 14,
                  fontWeight: FontWeight.bold,
                  fontFamily: 'monospace',
                ),
              ),
            ],
          ),
          
          const SizedBox(height: 12),
          
          // Title
          Text(
            listing.title,
            style: const TextStyle(
              color: Colors.white,
              fontSize: 16,
              fontWeight: FontWeight.bold,
              fontFamily: 'monospace',
            ),
          ),
          
          const SizedBox(height: 8),
          
          // Description
          Text(
            listing.description,
            style: TextStyle(
              color: AppTheme.primaryGreen.withAlpha((0.8 * 255).round()),
              fontSize: 14,
              fontFamily: 'monospace',
            ),
          ),
          
          if (listing.location != null) ...[
            const SizedBox(height: 8),
            Row(
              children: [
                const Icon(
                  Icons.location_on,
                  color: AppTheme.primaryGreen,
                  size: 16,
                ),
                const SizedBox(width: 4),
                Text(
                  listing.location!,
                  style: TextStyle(
                    color: AppTheme.primaryGreen.withAlpha((0.6 * 255).round()),
                    fontSize: 12,
                    fontFamily: 'monospace',
                  ),
                ),
              ],
            ),
          ],
          
          const SizedBox(height: 12),
          
          // Footer with seller info and actions
          Row(
            children: [
              Text(
                listing.sellerHandle,
                style: TextStyle(
                  color: AppTheme.primaryGreen.withAlpha((0.7 * 255).round()),
                  fontSize: 12,
                  fontFamily: 'monospace',
                ),
              ),
              const SizedBox(width: 8),
              Text(
                '• ${_formatTime(listing.timestamp)}',
                style: TextStyle(
                  color: AppTheme.primaryGreen.withAlpha((0.5 * 255).round()),
                  fontSize: 10,
                  fontFamily: 'monospace',
                ),
              ),
              const Spacer(),
              TerminalButton(
                text: 'CONTACT',
                onPressed: () => _contactSeller(listing.sellerHandle),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Color _getCategoryColor(String category) {
    switch (category) {
      case 'HAVE':
        return Colors.green;
      case 'WANT':
        return Colors.blue;
      case 'SERVICE':
        return Colors.purple;
      case 'EVENT':
        return Colors.orange;
      default:
        return AppTheme.primaryGreen;
    }
  }
}
