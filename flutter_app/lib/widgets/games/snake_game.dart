import 'package:flutter/material.dart';
import 'package:flutter/services.dart' show LogicalKeyboardKey;
import 'dart:async';
import 'dart:math';
import '../../theme/app_theme.dart';
import '../terminal_components.dart';

class SnakeGame extends StatefulWidget {
  final Function(int)? onWinXC;
  final VoidCallback? onBack;

  const SnakeGame({
    super.key,
    this.onWinXC,
    this.onBack,
  });

  @override
  State<SnakeGame> createState() => _SnakeGameState();
}

class _SnakeGameState extends State<SnakeGame> {
  static const int gridSize = 20;
  static const int initialSpeed = 200;
  
  List<Point> snake = [];
  Point food = Point(0, 0);
  Direction direction = Direction.right;
  bool gameRunning = false;
  bool gameOver = false;
  int score = 0;
  int speed = initialSpeed;
  Timer? gameTimer;

  @override
  void initState() {
    super.initState();
    _initializeGame();
  }

  @override
  void dispose() {
    gameTimer?.cancel();
    super.dispose();
  }

  void _initializeGame() {
    snake = [Point(10, 10), Point(9, 10), Point(8, 10)];
    direction = Direction.right;
    _generateFood();
    gameRunning = false;
    gameOver = false;
    score = 0;
    speed = initialSpeed;
  }

  void _generateFood() {
    final random = Random();
    do {
      food = Point(
        random.nextInt(gridSize),
        random.nextInt(gridSize),
      );
    } while (snake.contains(food));
  }

  void _startGame() {
    if (!gameRunning && !gameOver) {
      gameRunning = true;
      gameTimer = Timer.periodic(Duration(milliseconds: speed), (timer) {
        _updateGame();
      });
    }
  }

  void _pauseGame() {
    gameRunning = false;
    gameTimer?.cancel();
  }

  void _updateGame() {
    if (!gameRunning || gameOver) return;

    setState(() {
      final head = snake.first;
      Point newHead;

      switch (direction) {
        case Direction.up:
          newHead = Point(head.x, head.y - 1);
          break;
        case Direction.down:
          newHead = Point(head.x, head.y + 1);
          break;
        case Direction.left:
          newHead = Point(head.x - 1, head.y);
          break;
        case Direction.right:
          newHead = Point(head.x + 1, head.y);
          break;
      }

      // Check wall collision
      if (newHead.x < 0 || newHead.x >= gridSize ||
          newHead.y < 0 || newHead.y >= gridSize) {
        _endGame();
        return;
      }

      // Check self collision
      if (snake.contains(newHead)) {
        _endGame();
        return;
      }

      snake.insert(0, newHead);

      // Check food collision
      if (newHead.x == food.x && newHead.y == food.y) {
        score += 10;
        _generateFood();
        
        // Increase speed every 50 points
        if (score % 50 == 0 && speed > 100) {
          speed -= 20;
          gameTimer?.cancel();
          gameTimer = Timer.periodic(Duration(milliseconds: speed), (timer) {
            _updateGame();
          });
        }
      } else {
        snake.removeLast();
      }
    });
  }

  void _endGame() {
    gameRunning = false;
    gameOver = true;
    gameTimer?.cancel();
    
    // Award XC based on score
    final xcWinnings = (score / 10).floor();
    if (xcWinnings > 0) {
      widget.onWinXC?.call(xcWinnings);
    }
  }

  void _onKey(KeyEvent event) {
    if (!gameRunning || gameOver) return;

    switch (event.logicalKey) {
      case LogicalKeyboardKey.arrowUp:
        if (direction != Direction.down) direction = Direction.up;
        break;
      case LogicalKeyboardKey.arrowDown:
        if (direction != Direction.up) direction = Direction.down;
        break;
      case LogicalKeyboardKey.arrowLeft:
        if (direction != Direction.right) direction = Direction.left;
        break;
      case LogicalKeyboardKey.arrowRight:
        if (direction != Direction.left) direction = Direction.right;
        break;
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppTheme.background,
      appBar: AppBar(
        backgroundColor: AppTheme.background,
        elevation: 0,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back, color: AppTheme.primaryGreen),
          onPressed: widget.onBack,
        ),
        title: const Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            GlowText(text: 'SNAKE_GAME', fontSize: 20),
            Text(
              'Use arrow keys to control',
              style: TextStyle(
                color: AppTheme.primaryGreen,
                fontSize: 10,
                fontFamily: 'monospace',
              ),
            ),
          ],
        ),
        actions: [
          Text(
            'SCORE: $score',
            style: const TextStyle(
              color: Colors.amber,
              fontSize: 16,
              fontWeight: FontWeight.bold,
              fontFamily: 'monospace',
            ),
          ),
        ],
      ),
      body: KeyboardListener(
        focusNode: FocusNode(),
        onKeyEvent: _onKey,
        child: Center(
          child: AspectRatio(
            aspectRatio: 1.0,
            child: Container(
              decoration: BoxDecoration(
                color: Colors.black,
                border: Border.all(color: AppTheme.primaryGreen, width: 2),
                borderRadius: BorderRadius.circular(8),
              ),
              child: GridView.builder(
                physics: const NeverScrollableScrollPhysics(),
                gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                  crossAxisCount: gridSize,
                ),
                itemCount: gridSize * gridSize,
                itemBuilder: (context, index) {
                  final x = index % gridSize;
                  final y = index ~/ gridSize;
                  final point = Point(x, y);
                  
                  Color cellColor = Colors.black;
                  
                  if (snake.contains(point)) {
                    cellColor = point == snake.first ? Colors.white : AppTheme.primaryGreen;
                  } else if (food.x == x && food.y == y) {
                    cellColor = Colors.red;
                  }
                  
                  return Container(
                    margin: const EdgeInsets.all(0.5),
                    decoration: BoxDecoration(
                      color: cellColor,
                      borderRadius: BorderRadius.circular(2),
                    ),
                  );
                },
              ),
            ),
          ),
        ),
      ),
      bottomNavigationBar: Container(
        padding: const EdgeInsets.all(16),
        decoration: const BoxDecoration(
          border: Border(
            top: BorderSide(color: AppTheme.primaryGreen),
          ),
        ),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.spaceEvenly,
          children: [
            if (!gameRunning && !gameOver)
              TerminalButton(
                text: 'START',
                onPressed: _startGame,
              ),
            if (gameRunning)
              TerminalButton(
                text: 'PAUSE',
                onPressed: _pauseGame,
              ),
            if (gameOver)
              Column(
                children: [
                  const Text(
                    'GAME OVER',
                    style: TextStyle(
                      color: Colors.red,
                      fontSize: 16,
                      fontWeight: FontWeight.bold,
                      fontFamily: 'monospace',
                    ),
                  ),
                  const SizedBox(height: 8),
                  TerminalButton(
                    text: 'RESTART',
                    onPressed: () {
                      setState(() {
                        _initializeGame();
                      });
                    },
                  ),
                ],
              ),
          ],
        ),
      ),
    );
  }
}

enum Direction { up, down, left, right }

class Point {
  final int x;
  final int y;
  
  Point(this.x, this.y);
  
  @override
  bool operator ==(Object other) =>
      other is Point && other.x == x && other.y == y;
  
  @override
  int get hashCode => x.hashCode ^ y.hashCode;
}
