class BuzzItem {
  final String id;
  final String title;
  final String time;
  final String snippet;
  final String category;
  final String userName;
  final String userHandle;
  final String userAvatar;
  final String distance;
  int likes;
  int comments;
  bool isLiked;

  BuzzItem({
    required this.id,
    required this.title,
    required this.time,
    required this.snippet,
    required this.category,
    required this.userName,
    required this.userHandle,
    required this.userAvatar,
    required this.distance,
    required this.likes,
    required this.comments,
    required this.isLiked,
  });
}
