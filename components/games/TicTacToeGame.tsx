import React, { useState, useCallback, useEffect, useRef } from 'react';
import { hybridMesh } from '../../services/hybridMesh';

interface TicTacToeGameProps {
  onWinXC?: (amount: number) => void;
  onBack?: () => void;
  roomId?: string;
  isMultiplayer?: boolean;
}

type Player = 'X' | 'O' | null;
type Board = Player[];
type GameState = {
  board: Board;
  currentPlayer: Player;
  winner: Player;
  isDraw: boolean;
  score: { X: number; O: number };
};

const TicTacToeGame: React.FC<TicTacToeGameProps> = ({ onWinXC, onBack, roomId, isMultiplayer = false }) => {
  const [board, setBoard] = useState<Board>(Array(9).fill(null));
  const [currentPlayer, setCurrentPlayer] = useState<Player>('X');
  const [winner, setWinner] = useState<Player>(null);
  const [isDraw, setIsDraw] = useState(false);
  const [score, setScore] = useState({ X: 0, O: 0 });
  const [gameMode, setGameMode] = useState<'solo' | 'multiplayer'>('solo');
  const [isAIThinking, setIsAIThinking] = useState(false);
  const [isMultiplayerActive, setIsMultiplayerActive] = useState(false);
  const [gameId, setGameId] = useState('');
  const [myPlayer, setMyPlayer] = useState<Player>('X');
  const [opponentConnected, setOpponentConnected] = useState(false);

  // Real-time multiplayer sync
  const syncGameState = useCallback(() => {
    if (!isMultiplayer || !roomId || !isMultiplayerActive) return;
    
    const gameState: GameState = {
      board,
      currentPlayer,
      winner,
      isDraw,
      score
    };
    
    hybridMesh.sendMessage(JSON.stringify({
      type: 'tictactoe_game_update',
      gameId,
      state: gameState,
      myPlayer,
      timestamp: Date.now()
    }), roomId);
  }, [board, currentPlayer, winner, isDraw, score, myPlayer, isMultiplayer, roomId, isMultiplayerActive, gameId]);

  // Listen for multiplayer updates
  useEffect(() => {
    if (!isMultiplayer || !roomId) return;
    
    const handleGameMessage = (message: any) => {
      try {
        const data = JSON.parse(message.content);
        if (data.type === 'tictactoe_game_update' && data.gameId === gameId) {
          setBoard(data.state.board);
          setCurrentPlayer(data.state.currentPlayer);
          setWinner(data.state.winner);
          setIsDraw(data.state.isDraw);
          setScore(data.state.score);
          setOpponentConnected(true);
        } else if (data.type === 'tictactoe_invite' && !isMultiplayerActive) {
          // Auto-join game invites
          setGameId(data.gameId);
          setMyPlayer('O');
          setIsMultiplayerActive(true);
          setOpponentConnected(true);
        }
      } catch (error) {
        console.error('Failed to parse game message:', error);
      }
    };
    
    const unsubscribe = hybridMesh.subscribe('messageReceived', handleGameMessage);
    return unsubscribe;
  }, [isMultiplayer, roomId, gameId, isMultiplayerActive]);

  // Initialize multiplayer game
  const startMultiplayerGame = useCallback(() => {
    if (!roomId) return;
    
    const newGameId = `tictactoe_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    setGameId(newGameId);
    setMyPlayer('X');
    setIsMultiplayerActive(true);
    setOpponentConnected(false);
    
    hybridMesh.sendMessage(JSON.stringify({
      type: 'tictactoe_invite',
      gameId: newGameId,
      timestamp: Date.now()
    }), roomId);
  }, [roomId]);

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
    if (board[index] !== null || winner !== null || isDraw) return;
    
    // Check if it's my turn in multiplayer
    if (isMultiplayerActive && currentPlayer !== myPlayer) return;
    
    const newBoard = [...board];
    newBoard[index] = currentPlayer;
    setBoard(newBoard);

    const gameWinner = checkWinner(newBoard);
    if (gameWinner) {
      setWinner(gameWinner);
      const newScore = { ...score, [gameWinner]: score[gameWinner] + 1 };
      setScore(newScore);
      
      // Award XC for winning
      if (gameWinner === 'X' && gameMode === 'solo' && onWinXC) {
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
    
    // Sync multiplayer game state
    syncGameState();
  }, [board, currentPlayer, winner, isDraw, score, gameMode, myPlayer, isMultiplayerActive, checkWinner, checkDraw, getAIMove, onWinXC, syncGameState]);

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
      <div className="text-center mb-4 space-y-2">
        <div className="text-lg font-bold">
          {getStatusMessage()}
        </div>
        
        {/* Multiplayer Status */}
        {isMultiplayerActive && (
          <div className="text-xs space-y-1">
            <div className="text-green-400">
              🌐 Multiplayer Mode Active
            </div>
            <div className="opacity-60">
              You are: <span className={myPlayer === 'X' ? 'text-blue-400' : 'text-red-400'}>{myPlayer}</span>
            </div>
            <div className={opponentConnected ? 'text-green-400' : 'text-yellow-400'}>
              {opponentConnected ? '👤 Opponent Connected' : '⏳ Waiting for opponent...'}
            </div>
          </div>
        )}
        
        {/* Multiplayer Toggle */}
        {isMultiplayer && roomId && (
          <div className="mt-2">
            <button
              onClick={startMultiplayerGame}
              disabled={isMultiplayerActive}
              className="terminal-btn active px-4 py-2 text-xs border border-green-500/50 bg-green-500/20 text-green-400 disabled:opacity-30"
            >
              {isMultiplayerActive ? 'GAME IN PROGRESS' : 'START MULTIPLAYER'}
            </button>
          </div>
        )}
      </div>

      {/* Game Board */}
      <div className="flex-1 flex items-center justify-center">
        <div className="grid grid-cols-3 gap-2 max-w-xs mx-auto w-full">
          {board.map((cell, index) => (
            <button
              key={index}
              onClick={() => makeMove(index)}
              disabled={cell !== null || winner !== null || isDraw || isAIThinking || (isMultiplayerActive && currentPlayer !== myPlayer)}
              className={`
                aspect-square border-2 border-green-500/50 
                flex items-center justify-center text-2xl md:text-xl font-bold
                transition-all duration-200 active:scale-95
                ${cell === null && !isMultiplayerActive ? 'hover:bg-green-500/20 cursor-pointer' : ''}
                ${cell === null && isMultiplayerActive && currentPlayer === myPlayer ? 'hover:bg-green-500/20 cursor-pointer' : ''}
                ${cell === null && isMultiplayerActive && currentPlayer !== myPlayer ? 'cursor-not-allowed opacity-60' : ''}
                ${cell === 'X' ? 'text-blue-400 bg-blue-500/20' : ''}
                ${cell === 'O' ? 'text-red-400 bg-red-500/20' : ''}
                ${winner && cell === winner ? 'animate-pulse' : ''}
                min-h-[80px] md:min-h-[80px] min-w-[80px] md:min-w-[80px]
                text-3xl md:text-2xl
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
        
        {/* Win Messages */}
        {winner && gameMode === 'solo' && winner === 'X' && (
          <div className="text-xs text-yellow-400 font-bold">
            🎉 Earned 5 XC!
          </div>
        )}
        
        {winner && isMultiplayerActive && winner === myPlayer && (
          <div className="text-xs text-green-400 font-bold">
            🎉 You won! +5 XC
          </div>
        )}
        
        {winner && isMultiplayerActive && winner !== myPlayer && (
          <div className="text-xs text-red-400 font-bold">
            😔 Opponent won
          </div>
        )}
        
        {/* Mobile Instructions */}
        <div className="text-xs opacity-40 md:hidden space-y-1">
          <div>📱 Tap any cell to play</div>
          {isMultiplayerActive && (
            <div>⏳ Wait for your turn (You are {myPlayer})</div>
          )}
        </div>
        
        {/* Desktop Instructions */}
        <div className="text-xs opacity-40 hidden md:block">
          💻 Click any cell to play
        </div>
      </div>
    </div>
  );
};

export default TicTacToeGame;
