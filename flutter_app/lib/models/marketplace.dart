class MarketplaceListing {
  final String id;
  final String title;
  final String price;
  final String sellerHandle;
  final int timestamp;
  final String category;
  final String description;
  final String? location;

  MarketplaceListing({
    required this.id,
    required this.title,
    required this.price,
    required this.sellerHandle,
    required this.timestamp,
    required this.category,
    required this.description,
    this.location,
  });
}
