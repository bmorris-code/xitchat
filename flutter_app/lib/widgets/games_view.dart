import 'package:flutter/material.dart';
import '../theme/app_theme.dart';
import '../xc_economy.dart';
import 'terminal_components.dart';
import 'games/snake_game.dart';
import 'games/tic_tac_toe_game.dart';

class Game {
  final String id;
  final String name;
  final String category;
  final String xc;
  final String players;
  final String imageUrl;
  final String description;

  Game({
    required this.id,
    required this.name,
    required this.category,
    required this.xc,
    required this.players,
    required this.imageUrl,
    required this.description,
  });
}

class GamesView extends StatefulWidget {
  final VoidCallback? onBack;
  final Function(int)? onWinXC;

  const GamesView({
    super.key,
    this.onBack,
    this.onWinXC,
  });

  @override
  State<GamesView> createState() => _GamesViewState();
}

class _GamesViewState extends State<GamesView> {
  String? _activeGameId;

  final List<Game> _games = [
    Game(
      id: 'snake',
      name: 'Snake',
      category: 'Arcade',
      xc: 'Win up to 500XC',
      players: '12k',
      imageUrl: 'https://picsum.photos/seed/snake/400/200',
      description: 'Classic snake game with XC rewards',
    ),
    Game(
      id: 'tictactoe',
      name: 'Tic-Tac-Toe',
      category: 'Strategy',
      xc: 'Win 5XC per game',
      players: '8k',
      imageUrl: 'https://picsum.photos/seed/tictactoe/400/200',
      description: 'Play vs AI or friends',
    ),
    Game(
      id: 'memory',
      name: 'Memory Cards',
      category: 'Puzzle',
      xc: 'Win up to 100XC',
      players: '15k',
      imageUrl: 'https://picsum.photos/seed/memory/400/200',
      description: 'Test your memory skills',
    ),
    Game(
      id: 'rps',
      name: 'Rock Paper Scissors',
      category: 'Quick Play',
      xc: 'Win 2XC per round',
      players: '25k',
      imageUrl: 'https://picsum.photos/seed/rps/400/200',
      description: 'Classic hand game',
    ),
  ];

  void _launchGame(String gameId) {
    setState(() {
      _activeGameId = gameId;
    });
  }

  void _handleBackToGames() {
    setState(() {
      _activeGameId = null;
    });
  }

  void _awardXC(int amount) {
    widget.onWinXC?.call(amount);
    xcEconomy.addXC(amount, 'Game winnings', 'games');
  }

  @override
  Widget build(BuildContext context) {
    // Render active game
    if (_activeGameId == 'snake') {
      return SnakeGame(
        onWinXC: _awardXC,
        onBack: _handleBackToGames,
      );
    }

    if (_activeGameId == 'tictactoe') {
      return TicTacToeGame(
        onWinXC: _awardXC,
        onBack: _handleBackToGames,
      );
    }

    if (_activeGameId == 'memory') {
      return _buildComingSoon('MEMORY CARDS', '🧠', 'Memory card game is under development');
    }

    if (_activeGameId == 'rps') {
      return _buildComingSoon('ROCK PAPER SCISSORS', '✂️', 'Rock paper scissors game is under development');
    }

    // Games hub
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
            GlowText(text: 'play_lounge.bin', fontSize: 20),
            Text(
              'retro_arcade_and_gaming',
              style: TextStyle(
                color: AppTheme.primaryGreen,
                fontSize: 10,
                fontFamily: 'monospace',
              ),
            ),
          ],
        ),
      ),
      body: GridView.builder(
        padding: const EdgeInsets.all(16),
        gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
          crossAxisCount: 2,
          childAspectRatio: 1.2,
          crossAxisSpacing: 16,
          mainAxisSpacing: 16,
        ),
        itemCount: _games.length,
        itemBuilder: (context, index) {
          final game = _games[index];
          return _buildGameCard(game);
        },
      ),
    );
  }

  Widget _buildGameCard(Game game) {
    return GestureDetector(
      onTap: () => _launchGame(game.id),
      child: Container(
        decoration: BoxDecoration(
          color: AppTheme.surface,
          border: Border.all(color: AppTheme.primaryGreen.withAlpha((0.2 * 255).round())),
          borderRadius: BorderRadius.circular(12),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Game image placeholder
            Expanded(
              flex: 3,
              child: Container(
                width: double.infinity,
                decoration: BoxDecoration(
                  color: AppTheme.primaryGreen.withAlpha((0.1 * 255).round()),
                  borderRadius: const BorderRadius.vertical(top: Radius.circular(12)),
                ),
                child: const Icon(
                  Icons.games,
                  color: AppTheme.primaryGreen,
                  size: 48,
                ),
              ),
            ),
            Expanded(
              flex: 2,
              child: Padding(
                padding: const EdgeInsets.all(12),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          game.name,
                          style: const TextStyle(
                            color: Colors.white,
                            fontSize: 16,
                            fontWeight: FontWeight.bold,
                            fontFamily: 'monospace',
                          ),
                        ),
                        const SizedBox(height: 4),
                        Text(
                          game.category,
                          style: TextStyle(
                            color: AppTheme.primaryGreen.withAlpha((0.7 * 255).round()),
                            fontSize: 10,
                            fontFamily: 'monospace',
                          ),
                        ),
                      ],
                    ),
                    Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          game.xc,
                          style: const TextStyle(
                            color: Colors.amber,
                            fontSize: 10,
                            fontWeight: FontWeight.bold,
                            fontFamily: 'monospace',
                          ),
                        ),
                        const SizedBox(height: 2),
                        Text(
                          '${game.players} players',
                          style: TextStyle(
                            color: AppTheme.primaryGreen.withAlpha((0.5 * 255).round()),
                            fontSize: 8,
                            fontFamily: 'monospace',
                          ),
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

  Widget _buildComingSoon(String title, String emoji, String description) {
    return Scaffold(
      backgroundColor: AppTheme.background,
      appBar: AppBar(
        backgroundColor: AppTheme.background,
        elevation: 0,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back, color: AppTheme.primaryGreen),
          onPressed: _handleBackToGames,
        ),
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            GlowText(text: title, fontSize: 20),
            const Text(
              'Coming Soon',
              style: TextStyle(
                color: AppTheme.primaryGreen,
                fontSize: 10,
                fontFamily: 'monospace',
              ),
            ),
          ],
        ),
      ),
      body: Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Text(
              emoji,
              style: const TextStyle(fontSize: 64),
            ),
            const SizedBox(height: 16),
            const Text(
              'COMING SOON!',
              style: TextStyle(
                color: Colors.white,
                fontSize: 24,
                fontWeight: FontWeight.bold,
                fontFamily: 'monospace',
              ),
            ),
            const SizedBox(height: 8),
            Text(
              description,
              style: TextStyle(
                color: AppTheme.primaryGreen.withAlpha((0.6 * 255).round()),
                fontSize: 14,
                fontFamily: 'monospace',
              ),
              textAlign: TextAlign.center,
            ),
          ],
        ),
      ),
    );
  }
}
