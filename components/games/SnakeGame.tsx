import React, { useState, useEffect, useCallback, useRef } from 'react';

interface SnakeGameProps {
  onWinXC?: (amount: number) => void;
  onBack?: () => void;
}

interface Position {
  x: number;
  y: number;
}

const GRID_SIZE = 20;
const CELL_SIZE = 20;
const INITIAL_SPEED = 150;

// Responsive cell size for mobile
const getResponsiveCellSize = () => {
  if (typeof window !== 'undefined') {
    const screenWidth = window.innerWidth;
    if (screenWidth < 640) return 15; // Mobile
    if (screenWidth < 1024) return 18; // Tablet
    return 20; // Desktop
  }
  return 20;
};

const SnakeGame: React.FC<SnakeGameProps> = ({ onWinXC, onBack }) => {
  const [snake, setSnake] = useState<Position[]>([{ x: 10, y: 10 }]);
  const [food, setFood] = useState<Position>({ x: 15, y: 15 });
  const [direction, setDirection] = useState<Position>({ x: 1, y: 0 });
  const [gameOver, setGameOver] = useState(false);
  const [score, setScore] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [highScore, setHighScore] = useState(0);
  const [cellSize, setCellSize] = useState(CELL_SIZE);
  const gameLoopRef = useRef<NodeJS.Timeout>();

  // Update cell size on window resize
  useEffect(() => {
    const updateCellSize = () => {
      setCellSize(getResponsiveCellSize());
    };
    
    updateCellSize();
    window.addEventListener('resize', updateCellSize);
    return () => window.removeEventListener('resize', updateCellSize);
  }, []);

  // Load high score from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('snake_high_score');
    if (saved) {
      setHighScore(parseInt(saved));
    }
  }, []);

  const generateRandomFood = useCallback((currentSnake: Position[]): Position => {
    let newFood: Position;
    do {
      newFood = {
        x: Math.floor(Math.random() * GRID_SIZE),
        y: Math.floor(Math.random() * GRID_SIZE)
      };
    } while (currentSnake.some(segment => segment.x === newFood.x && segment.y === newFood.y));
    return newFood;
  }, []);

  const resetGame = useCallback(() => {
    setSnake([{ x: 10, y: 10 }]);
    setFood({ x: 15, y: 15 });
    setDirection({ x: 1, y: 0 });
    setGameOver(false);
    setScore(0);
    setIsPlaying(false);
  }, []);

  const moveSnake = useCallback(() => {
    if (gameOver || !isPlaying) return;

    setSnake(currentSnake => {
      const newSnake = [...currentSnake];
      const head = { ...newSnake[0] };
      head.x += direction.x;
      head.y += direction.y;

      // Check wall collision
      if (head.x < 0 || head.x >= GRID_SIZE || head.y < 0 || head.y >= GRID_SIZE) {
        setGameOver(true);
        setIsPlaying(false);
        return currentSnake;
      }

      // Check self collision
      if (newSnake.some(segment => segment.x === head.x && segment.y === head.y)) {
        setGameOver(true);
        setIsPlaying(false);
        return currentSnake;
      }

      newSnake.unshift(head);

      // Check food collision
      if (head.x === food.x && head.y === food.y) {
        const newScore = score + 10;
        setScore(newScore);
        setFood(generateRandomFood(newSnake));
        
        // Award XC for milestones
        if (newScore % 50 === 0 && onWinXC) {
          onWinXC(Math.floor(newScore / 50));
        }
      } else {
        newSnake.pop();
      }

      return newSnake;
    });
  }, [direction, food, gameOver, isPlaying, score, generateRandomFood, onWinXC]);

  // Game loop
  useEffect(() => {
    if (isPlaying && !gameOver) {
      gameLoopRef.current = setTimeout(moveSnake, INITIAL_SPEED);
      return () => {
        if (gameLoopRef.current) {
          clearTimeout(gameLoopRef.current);
        }
      };
    }
  }, [moveSnake, isPlaying, gameOver]);

  // Keyboard controls
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (!isPlaying && e.key === ' ') {
        setIsPlaying(true);
        return;
      }

      if (gameOver && e.key === ' ') {
        resetGame();
        return;
      }

      if (!isPlaying) return;

      switch (e.key) {
        case 'ArrowUp':
          if (direction.y === 0) setDirection({ x: 0, y: -1 });
          break;
        case 'ArrowDown':
          if (direction.y === 0) setDirection({ x: 0, y: 1 });
          break;
        case 'ArrowLeft':
          if (direction.x === 0) setDirection({ x: -1, y: 0 });
          break;
        case 'ArrowRight':
          if (direction.x === 0) setDirection({ x: 1, y: 0 });
          break;
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [direction, isPlaying, gameOver]);

  // Update high score
  useEffect(() => {
    if (score > highScore) {
      setHighScore(score);
      localStorage.setItem('snake_high_score', score.toString());
    }
  }, [score, highScore]);

  // Touch controls for mobile
  const handleTouch = (dx: number, dy: number) => {
    if (!isPlaying) return;
    
    if (Math.abs(dx) > Math.abs(dy)) {
      if (dx > 0 && direction.x === 0) setDirection({ x: 1, y: 0 });
      else if (dx < 0 && direction.x === 0) setDirection({ x: -1, y: 0 });
    } else {
      if (dy > 0 && direction.y === 0) setDirection({ x: 0, y: 1 });
      else if (dy < 0 && direction.y === 0) setDirection({ x: 0, y: -1 });
    }
  };

  // D-Pad controls for mobile
  const handleDPad = (newDirection: Position) => {
    if (!isPlaying) return;
    
    // Prevent reversing direction
    if ((newDirection.x === 1 && direction.x === -1) || 
        (newDirection.x === -1 && direction.x === 1) ||
        (newDirection.y === 1 && direction.y === -1) || 
        (newDirection.y === -1 && direction.y === 1)) {
      return;
    }
    
    setDirection(newDirection);
  };

  const renderCell = (x: number, y: number, isSnake: boolean, isFood: boolean, isHead: boolean) => {
    let cellClass = 'absolute border border-green-500/30 ';
    if (isHead) {
      cellClass += 'bg-green-500 ';
    } else if (isSnake) {
      cellClass += 'bg-green-600 ';
    } else if (isFood) {
      cellClass += 'bg-red-500 ';
    } else {
      cellClass += 'bg-black ';
    }
    
    return (
      <div
        className={cellClass}
        style={{
          left: `${x * cellSize}px`,
          top: `${y * cellSize}px`,
          width: `${cellSize}px`,
          height: `${cellSize}px`
        }}
      />
    );
  };

  return (
    <div className="flex-1 flex flex-col bg-black text-green-400 font-mono p-4">
      {/* Header */}
      <div className="flex justify-between items-center mb-4 border-b border-green-500/30 pb-4">
        <div className="flex items-center gap-4">
          <button onClick={onBack} className="terminal-btn text-xs px-2 py-1 h-8 min-h-0 uppercase">back</button>
          <div>
            <h2 className="text-xl font-bold">SNAKE</h2>
            <p className="text-xs opacity-60">Classic Arcade</p>
          </div>
        </div>
        <div className="text-right">
          <div className="text-xs opacity-60">HIGH SCORE</div>
          <div className="text-lg font-bold">{highScore}</div>
        </div>
      </div>

      {/* Game Stats */}
      <div className="flex justify-between items-center mb-4">
        <div className="text-sm">
          <span className="opacity-60">SCORE: </span>
          <span className="font-bold ml-2">{score}</span>
        </div>
        <div className="text-sm">
          <span className="opacity-60">STATUS: </span>
          <span className={`font-bold ml-2 ${gameOver ? 'text-red-400' : isPlaying ? 'text-green-400' : 'text-yellow-400'}`}>
            {gameOver ? 'GAME OVER' : isPlaying ? 'PLAYING' : 'READY'}
          </span>
        </div>
      </div>

      {/* Game Board */}
      <div className="flex-1 flex items-center justify-center">
        <div 
          className="relative border-2 border-green-500/50 bg-black"
          style={{
            width: `${GRID_SIZE * cellSize}px`,
            height: `${GRID_SIZE * cellSize}px`,
            maxWidth: '100%',
            maxHeight: '70vh'
          }}
          onTouchStart={(e) => {
            const touch = e.touches[0];
            const startX = touch.clientX;
            const startY = touch.clientY;
            
            const handleTouchEnd = (e: any) => {
              const endTouch = e.changedTouches[0];
              const endX = endTouch.clientX;
              const endY = endTouch.clientY;
              handleTouch(endX - startX, endY - startY);
            };
            
            const element = e.currentTarget;
            element.addEventListener('touchend', handleTouchEnd, { once: true });
          }}
        >
          {/* Render snake and food */}
          {Array.from({ length: GRID_SIZE }, (_, y) =>
            Array.from({ length: GRID_SIZE }, (_, x) => {
              const isHead = snake[0]?.x === x && snake[0]?.y === y;
              const isSnake = snake.some(segment => segment.x === x && segment.y === y);
              const isFood = food.x === x && food.y === y;
              return (
                <div key={`${x}-${y}`}>
                  {renderCell(x, y, isSnake, isFood, isHead)}
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Mobile D-Pad Controls */}
      <div className="md:hidden mt-6 flex flex-col items-center gap-2">
        <div className="text-xs opacity-60 mb-2">D-PAD CONTROLS</div>
        
        {/* D-Pad Layout */}
        <div className="relative w-32 h-32">
          {/* Up Button */}
          <button
            onClick={() => handleDPad({ x: 0, y: -1 })}
            disabled={!isPlaying}
            className="absolute top-0 left-1/2 -translate-x-1/2 w-10 h-10 border border-green-500/50 bg-green-500/20 text-green-400 flex items-center justify-center terminal-btn active disabled:opacity-30"
            style={{ minHeight: '44px', minWidth: '44px' }}
          >
            <i className="fa-solid fa-chevron-up text-lg"></i>
          </button>
          
          {/* Left Button */}
          <button
            onClick={() => handleDPad({ x: -1, y: 0 })}
            disabled={!isPlaying}
            className="absolute left-0 top-1/2 -translate-y-1/2 w-10 h-10 border border-green-500/50 bg-green-500/20 text-green-400 flex items-center justify-center terminal-btn active disabled:opacity-30"
            style={{ minHeight: '44px', minWidth: '44px' }}
          >
            <i className="fa-solid fa-chevron-left text-lg"></i>
          </button>
          
          {/* Right Button */}
          <button
            onClick={() => handleDPad({ x: 1, y: 0 })}
            disabled={!isPlaying}
            className="absolute right-0 top-1/2 -translate-y-1/2 w-10 h-10 border border-green-500/50 bg-green-500/20 text-green-400 flex items-center justify-center terminal-btn active disabled:opacity-30"
            style={{ minHeight: '44px', minWidth: '44px' }}
          >
            <i className="fa-solid fa-chevron-right text-lg"></i>
          </button>
          
          {/* Down Button */}
          <button
            onClick={() => handleDPad({ x: 0, y: 1 })}
            disabled={!isPlaying}
            className="absolute bottom-0 left-1/2 -translate-x-1/2 w-10 h-10 border border-green-500/50 bg-green-500/20 text-green-400 flex items-center justify-center terminal-btn active disabled:opacity-30"
            style={{ minHeight: '44px', minWidth: '44px' }}
          >
            <i className="fa-solid fa-chevron-down text-lg"></i>
          </button>
          
          {/* Center Circle (Decorative) */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-8 border border-green-500/30 bg-black flex items-center justify-center">
            <div className="w-2 h-2 bg-green-500/50 rounded-full"></div>
          </div>
        </div>
      </div>
          {/* Controls */}
      <div className="mt-4 text-center">
        <div className="text-xs opacity-60 mb-2">
          {isPlaying ? 'Use arrow keys to move' : gameOver ? 'Press SPACE to restart' : 'Press SPACE to start'}
        </div>
        <div className="text-xs opacity-40 md:hidden">
          Mobile: Use D-Pad or swipe to control
        </div>
        <div className="text-xs opacity-40 hidden md:block">
          Desktop: Use arrow keys
        </div>
        {score > 0 && score % 50 === 0 && (
          <div className="text-xs text-yellow-400 font-bold mt-2">
            🎉 Earned {Math.floor(score / 50)} XC!
          </div>
        )}
      </div>
    </div>
  );
};

export default SnakeGame;
