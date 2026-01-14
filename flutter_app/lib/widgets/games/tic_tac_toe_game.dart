import 'package:flutter/material.dart';
import 'dart:math';
import '../../theme/app_theme.dart';
import '../terminal_components.dart';

class TicTacToeGame extends StatefulWidget {
  final Function(int)? onWinXC;
  final VoidCallback? onBack;

  const TicTacToeGame({
    super.key,
    this.onWinXC,
    this.onBack,
  });

  @override
  State<TicTacToeGame> createState() => _TicTacToeGameState();
}

class _TicTacToeGameState extends State<TicTacToeGame> {
  List<String> board = List.filled(9, '');
  String currentPlayer = 'X';
  String player = 'X';
  String ai = 'O';
  bool gameOver = false;
  String winner = '';
  int playerScore = 0;
  int aiScore = 0;

  @override
  void initState() {
    super.initState();
    _resetGame();
  }

  void _resetGame() {
    setState(() {
      board = List.filled(9, '');
      currentPlayer = player;
      gameOver = false;
      winner = '';
    });
  }

  void _makeMove(int index) {
    if (board[index].isEmpty && !gameOver && currentPlayer == player) {
      setState(() {
        board[index] = currentPlayer;
        
        if (_checkWinner(currentPlayer)) {
          winner = currentPlayer;
          gameOver = true;
          if (winner == player) {
            playerScore++;
            widget.onWinXC?.call(5);
          } else {
            aiScore++;
          }
        } else if (_isBoardFull()) {
          gameOver = true;
        } else {
          currentPlayer = currentPlayer == player ? ai : player;
          if (currentPlayer == ai) {
            _makeAIMove();
          }
        }
      });
    }
  }

  void _makeAIMove() {
    Future.delayed(const Duration(milliseconds: 500), () {
      if (!gameOver && currentPlayer == ai) {
        final move = _getBestMove();
        if (move != -1) {
          setState(() {
            board[move] = ai;
            
            if (_checkWinner(ai)) {
              winner = ai;
              gameOver = true;
              aiScore++;
            } else if (_isBoardFull()) {
              gameOver = true;
            } else {
              currentPlayer = player;
            }
          });
        }
      }
    });
  }

  int _getBestMove() {
    // Try to win
    for (int i = 0; i < 9; i++) {
      if (board[i].isEmpty) {
        board[i] = ai;
        if (_checkWinner(ai)) {
          board[i] = '';
          return i;
        }
        board[i] = '';
      }
    }

    // Try to block
    for (int i = 0; i < 9; i++) {
      if (board[i].isEmpty) {
        board[i] = player;
        if (_checkWinner(player)) {
          board[i] = '';
          return i;
        }
        board[i] = '';
      }
    }

    // Take center
    if (board[4].isEmpty) return 4;

    // Take corners
    final corners = [0, 2, 6, 8];
    final availableCorners = corners.where((i) => board[i].isEmpty).toList();
    if (availableCorners.isNotEmpty) {
      return availableCorners[Random().nextInt(availableCorners.length)];
    }

    // Take any available space
    final available = List.generate(9, (i) => i).where((i) => board[i].isEmpty).toList();
    return available.isNotEmpty ? available[Random().nextInt(available.length)] : -1;
  }

  bool _checkWinner(String player) {
    const winPatterns = [
      [0, 1, 2], [3, 4, 5], [6, 7, 8], // Rows
      [0, 3, 6], [1, 4, 7], [2, 5, 8], // Columns
      [0, 4, 8], [2, 4, 6], // Diagonals
    ];

    for (final pattern in winPatterns) {
      if (board[pattern[0]] == player &&
          board[pattern[1]] == player &&
          board[pattern[2]] == player) {
        return true;
      }
    }
    return false;
  }

  bool _isBoardFull() {
    return board.every((cell) => cell.isNotEmpty);
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
            GlowText(text: 'TIC_TAC_TOE', fontSize: 20),
            Text(
              'Play vs AI',
              style: TextStyle(
                color: AppTheme.primaryGreen,
                fontSize: 10,
                fontFamily: 'monospace',
               
              ),
            ),
          ],
        ),
        actions: [
          Column(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              Text(
                'YOU: $playerScore',
                style: const TextStyle(
                  color: Colors.blue,
                  fontSize: 12,
                  fontWeight: FontWeight.bold,
                  fontFamily: 'monospace',
                ),
              ),
              Text(
                'AI: $aiScore',
                style: const TextStyle(
                  color: Colors.red,
                  fontSize: 12,
                  fontWeight: FontWeight.bold,
                  fontFamily: 'monospace',
                ),
              ),
            ],
          ),
        ],
      ),
      body: Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            // Game status
            if (gameOver)
              Container(
                padding: const EdgeInsets.all(16),
                margin: const EdgeInsets.only(bottom: 20),
                decoration: BoxDecoration(
                 color: winner == player
                      ? Colors.blue.withAlpha((0.2 * 255).round())
                      : Colors.red.withAlpha((0.2 * 255).round()), // <-- FIX IS HERE (added comma)
                  border: Border.all(color: winner == player ? Colors.blue : Colors.red),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Text(
                  winner == player ? 'YOU WIN! +5XC' : winner == ai ? 'AI WINS!' : 'DRAW!',
                  style: TextStyle(
                    color: winner == player ? Colors.blue : winner == ai ? Colors.red : Colors.white,
                    fontSize: 18,
                    fontWeight: FontWeight.bold,
                    fontFamily: 'monospace',
                  ),
                ),
              ),
            
            // Game board
            AspectRatio(
              aspectRatio: 1.0,
              child: Container(
                width: 300,
                decoration: BoxDecoration(
                  color: Colors.black,
                  border: Border.all(color: AppTheme.primaryGreen, width: 2),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: GridView.builder(
                  physics: const NeverScrollableScrollPhysics(),
                  gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                    crossAxisCount: 3,
                  ),
                  itemCount: 9,
                  itemBuilder: (context, index) {
                    return GestureDetector(
                      onTap: () => _makeMove(index),
                      child: Container(
                        margin: const EdgeInsets.all(2),
                        decoration: BoxDecoration(
                          color: Colors.black,
                          border: Border.all(
                            color: AppTheme.primaryGreen.withAlpha((0.3 * 255).round()),
                            width: 1,
                          ),
                        ),
                        child: Center(
                          child: Text(
                            board[index],
                            style: TextStyle(
                              color: board[index] == player 
                                  ? Colors.blue 
                                  : board[index] == ai 
                                      ? Colors.red 
                                      : Colors.transparent,
                              fontSize: 32,
                              fontWeight: FontWeight.bold,
                              fontFamily: 'monospace',
                            ),
                          ),
                        ),
                      ),
                    );
                  },
                ),
              ),
            ),
            
            const SizedBox(height: 20),
            
            // Controls
            TerminalButton(
              text: gameOver ? 'NEW GAME' : 'RESET',
              onPressed: _resetGame,
            ),
          ],
        ),
      ),
    );
  }
}
