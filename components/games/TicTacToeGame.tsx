import React, { useState, useCallback } from 'react';

interface TicTacToeGameProps {
  onWinXC?: (amount: number) => void;
  onBack?: () => void;
}

type Player = 'X' | 'O' | null;
type Board = Player[];

const TicTacToeGame: React.FC<TicTacToeGameProps> = ({ onWinXC, onBack }) => {
  const [board, setBoard] = useState<Board>(Array(9).fill(null));
  const [currentPlayer, setCurrentPlayer] = useState<Player>('X');
  const [winner, setWinner] = useState<Player>(null);
  const [isDraw, setIsDraw] = useState(false);
  const [score, setScore] = useState({ X: 0, O: 0 });
  const [gameMode, setGameMode] = useState<'solo' | 'multiplayer'>('solo');
  const [isAIThinking, setIsAIThinking] = useState(false);

  const checkDraw = useCallback((board: Board): boolean => {
    return board.every(cell => cell !== null);
  }, []);

  const checkWinner = useCallback((board: Board): Player | null => {
    const lines = [
      [0, 1, 2], [3, 4, 5], [6, 7, 8], // Rows
      [0, 3, 6], [1, 4, 7], [2, 5, 8], // Columns
      [0, 4, 8], [2, 4, 6] // Diagonals
    ];

    for (const line of lines) {
      const [a, b, c] = line;
      const cellA = board[a];
      const cellB = board[b];
      const cellC = board[c];
      if (cellA && cellA === cellB && cellB === cellC) {
        return cellA;
      }
    }
    return null;
  }, []);

  const minimax = useCallback((board: Board, depth: number, isMaximizing: boolean): number => {
    const winner = checkWinner(board);
    if (winner === 'O') return -10 + depth;
    if (winner === 'X') return 10 - depth;
    if (checkDraw(board)) return 0;

    if (depth === 0) return 0;

    let bestScore: number = isMaximizing ? -Infinity : Infinity;

    for (let i = 0; i < 9; i++) {
      if (board[i] === null) {
        board[i] = isMaximizing ? 'X' : 'O';
        const score = minimax(board, depth - 1, !isMaximizing);
        board[i] = null;
        bestScore = isMaximizing ? Math.max(bestScore, score) : Math.min(bestScore, score);
      }
    }

    return bestScore;
  }, [checkWinner, checkDraw]);

  const getAIMove = useCallback((board: Board): number => {
    let bestScore = -Infinity;
    let bestMove = -1;

    for (let i = 0; i < 9; i++) {
      if (board[i] === null) {
        board[i] = 'O';
        const score = minimax(board, 3, false);
        board[i] = null;
        
        if (score > bestScore) {
          bestScore = score;
          bestMove = i;
        }
      }
    }

    return bestMove;
  }, [minimax]);

  const makeMove = useCallback((index: number) => {
    if (board[index] !== null || winner || isDraw) return;

    const newBoard = [...board];
    newBoard[index] = currentPlayer;
    setBoard(newBoard);

    const gameWinner = checkWinner(newBoard);
    if (gameWinner) {
      setWinner(gameWinner);
      setScore(prev => ({ ...prev, [gameWinner]: prev[gameWinner] + 1 }));
      
      // Award XC for winning
      if (onWinXC && gameMode === 'solo' && gameWinner === 'X') {
        onWinXC(5);
      }
    } else if (checkDraw(newBoard)) {
      setIsDraw(true);
    } else {
      setCurrentPlayer(currentPlayer === 'X' ? 'O' : 'X');
      
      // AI move in solo mode
      if (gameMode === 'solo' && currentPlayer === 'O') {
        setIsAIThinking(true);
        setTimeout(() => {
          const aiMove = getAIMove(newBoard);
          makeMove(aiMove);
          setIsAIThinking(false);
        }, 500);
      }
    }
  }, [board, currentPlayer, winner, isDraw, gameMode, checkWinner, checkDraw, getAIMove, onWinXC]);

  const resetGame = () => {
    setBoard(Array(9).fill(null));
    setCurrentPlayer('X');
    setWinner(null);
    setIsDraw(false);
    setIsAIThinking(false);
  };

  const switchMode = () => {
    resetGame();
    setGameMode(gameMode === 'solo' ? 'multiplayer' : 'solo');
  };

  const getStatusMessage = () => {
    if (winner) {
      return `Player ${winner} Wins!`;
    }
    if (isDraw) {
      return "It's a Draw!";
    }
    if (isAIThinking) {
      return "AI is thinking...";
    }
    if (gameMode === 'solo') {
      return currentPlayer === 'X' ? 'Your turn' : 'AI turn';
    }
    return `Player ${currentPlayer}'s turn`;
  };

  const getScoreColor = (player: Player) => {
    return player === 'X' ? 'text-blue-400' : 'text-red-400';
  };

  return (
    <div className="flex-1 flex flex-col bg-black text-green-400 font-mono p-4">
      {/* Header */}
      <div className="flex justify-between items-center mb-4 border-b border-green-500/30 pb-4">
        <div className="flex items-center gap-4">
          <button onClick={onBack} className="terminal-btn text-xs px-2 py-1 h-8 min-h-0 uppercase">back</button>
          <div>
            <h2 className="text-xl font-bold">TIC-TAC-TOE</h2>
            <p className="text-xs opacity-60">Classic Strategy</p>
          </div>
        </div>
        <button 
          onClick={switchMode}
          className="terminal-btn text-xs px-2 py-1 h-8 min-h-0 uppercase"
        >
          {gameMode === 'solo' ? 'VS AI' : '2 PLAYER'}
        </button>
      </div>

      {/* Scores */}
      <div className="flex justify-center gap-8 mb-4">
        <div className="text-center">
          <div className={`text-2xl font-bold ${getScoreColor('X')}`}>X</div>
          <div className="text-sm opacity-60">Player</div>
          <div className="text-lg font-bold">{score.X}</div>
        </div>
        <div className="text-center">
          <div className={`text-2xl font-bold ${getScoreColor('O')}`}>O</div>
          <div className="text-sm opacity-60">{gameMode === 'solo' ? 'AI' : 'Player'}</div>
          <div className="text-lg font-bold">{score.O}</div>
        </div>
      </div>

      {/* Game Status */}
      <div className="text-center mb-4">
        <div className="text-lg font-bold">
          {getStatusMessage()}
        </div>
      </div>

      {/* Game Board */}
      <div className="flex-1 flex items-center justify-center">
        <div className="grid grid-cols-3 gap-2 max-w-xs mx-auto w-full">
          {board.map((cell, index) => (
            <button
              key={index}
              onClick={() => makeMove(index)}
              disabled={cell !== null || winner !== null || isDraw || isAIThinking}
              className={`
                aspect-square border-2 border-green-500/50 
                flex items-center justify-center text-2xl md:text-xl font-bold
                transition-all duration-200 active:scale-95
                ${cell === null ? 'hover:bg-green-500/20 cursor-pointer' : 'cursor-not-allowed'}
                ${cell === 'X' ? 'text-blue-400 bg-blue-500/20' : ''}
                ${cell === 'O' ? 'text-red-400 bg-red-500/20' : ''}
                ${winner && cell === winner ? 'animate-pulse' : ''}
                min-h-[60px] md:min-h-[80px] min-w-[60px] md:min-w-[80px]
              `}
            >
              {cell}
            </button>
          ))}
        </div>
      </div>

      {/* Controls */}
      <div className="mt-4 text-center space-y-2">
        <button
          onClick={resetGame}
          className="terminal-btn active px-6 py-3 text-sm font-bold uppercase min-h-[44px] min-w-[120px]"
        >
          New Game
        </button>
        {winner && gameMode === 'solo' && winner === 'X' && (
          <div className="text-xs text-yellow-400 font-bold">
            🎉 Earned 5 XC!
          </div>
        )}
        <div className="text-xs opacity-40 md:hidden">
          Tap any cell to play
        </div>
      </div>
    </div>
  );
};

export default TicTacToeGame;
