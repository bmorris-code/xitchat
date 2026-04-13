
import React, { useState, useEffect } from 'react';
import SnakeGame from './games/SnakeGame';
import TicTacToeGame from './games/TicTacToeGame';

interface GamesViewProps {
  onWinXC?: (amount: number) => void;
  onBack?: () => void;
}

const GamesView: React.FC<GamesViewProps> = ({ onWinXC, onBack }) => {
  const [activeGameId, setActiveGameId] = useState<string | null>(null);

  const games = [
    { 
      id: 'snake', 
      name: 'Snake', 
      category: 'Arcade', 
      xc: 'Win up to 500XC', 
      players: '12k', 
      img: '/icon-192.png',
      description: 'Classic snake game with XC rewards'
    },
    { 
      id: 'tictactoe', 
      name: 'Tic-Tac-Toe', 
      category: 'Strategy', 
      xc: 'Win 5XC per game', 
      players: '8k', 
      img: '/icon-192.png',
      description: 'Play vs AI or friends'
    },
    { 
      id: 'memory', 
      name: 'Memory Cards', 
      category: 'Puzzle', 
      xc: 'Win up to 100XC', 
      players: '15k', 
      img: '/icon-192.png',
      description: 'Test your memory skills'
    },
    { 
      id: 'rps', 
      name: 'Rock Paper Scissors', 
      category: 'Quick Play', 
      xc: 'Win 2XC per round', 
      players: '25k', 
      img: '/icon-192.png',
      description: 'Classic hand game'
    }
  ];

  const launchGame = (id: string) => {
    setActiveGameId(id);
  };

  const handleBackToGames = () => {
    setActiveGameId(null);
  };

  // Render active game
  if (activeGameId === 'snake') {
    return <SnakeGame onWinXC={onWinXC} onBack={handleBackToGames} />;
  }

  if (activeGameId === 'tictactoe') {
    return <TicTacToeGame onWinXC={onWinXC} onBack={handleBackToGames} />;
  }

  if (activeGameId === 'memory') {
    return (
      <div className="flex-1 flex flex-col bg-black text-green-400 font-mono p-4">
        <div className="flex justify-between items-center mb-4 border-b border-green-500/30 pb-4">
          <div className="flex items-center gap-4">
            <button onClick={handleBackToGames} className="terminal-btn text-xs px-2 py-1 h-8 min-h-0 uppercase">back</button>
            <div>
              <h2 className="text-xl font-bold">MEMORY CARDS</h2>
              <p className="text-xs opacity-60">Memory Challenge</p>
            </div>
          </div>
        </div>
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="text-6xl mb-4">🧠</div>
            <h3 className="text-xl font-bold mb-2">Coming Soon!</h3>
            <p className="text-sm opacity-60">Memory card game is under development</p>
          </div>
        </div>
      </div>
    );
  }

  if (activeGameId === 'rps') {
    return (
      <div className="flex-1 flex flex-col bg-black text-green-400 font-mono p-4">
        <div className="flex justify-between items-center mb-4 border-b border-green-500/30 pb-4">
          <div className="flex items-center gap-4">
            <button onClick={handleBackToGames} className="terminal-btn text-xs px-2 py-1 h-8 min-h-0 uppercase">back</button>
            <div>
              <h2 className="text-xl font-bold">ROCK PAPER SCISSORS</h2>
              <p className="text-xs opacity-60">Quick Play</p>
            </div>
          </div>
        </div>
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="text-6xl mb-4">✂️</div>
            <h3 className="text-xl font-bold mb-2">Coming Soon!</h3>
            <p className="text-sm opacity-60">Rock Paper Scissors is under development</p>
          </div>
        </div>
      </div>
    );
  }

  // Games list view
  return (
    <div className="flex-1 flex flex-col bg-black text-current font-mono p-3">
      {/* Header */}
      <div className="flex justify-between items-center mb-4 border-b border-current pb-3">
        <div className="flex items-center gap-2 min-w-0">
          {onBack && (
            <button onClick={onBack} className="terminal-btn px-2 py-0 h-8 text-[10px] uppercase shrink-0">back</button>
          )}
          <div className="min-w-0">
            <h2 className="text-base font-bold uppercase tracking-tight glow-text truncate">play_lounge.exe</h2>
            <p className="text-[9px] font-bold opacity-50 uppercase tracking-wider mt-0.5 text-white/40 truncate">active_games_directory</p>
          </div>
        </div>
        <div className="text-right shrink-0 ml-2">
          <div className="text-[9px] opacity-40 uppercase tracking-wide">players</div>
          <div className="text-base font-bold">{games.reduce((sum, game) => sum + parseInt(game.players), 0).toLocaleString()}</div>
        </div>
      </div>

      {/* Scrollable Games Container */}
      <div className="flex-1 overflow-y-auto no-scrollbar">
        {/* Games Grid */}
        <div className="grid grid-cols-1 gap-3 pb-4">
          {games.map((game) => (
            <div
              key={game.id}
              onClick={() => launchGame(game.id)}
              className="border border-current border-opacity-30 bg-[#050505] p-3 flex flex-col gap-3 hover:bg-white/[0.05] hover:border-opacity-100 transition-all cursor-pointer group active:scale-95"
            >
              {/* Game Image */}
              <div className="aspect-video bg-black border border-current border-opacity-20 overflow-hidden relative">
                <img
                  src={game.img}
                  alt={game.name}
                  className="w-full h-full object-cover opacity-50 group-hover:opacity-100 transition-all"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent flex items-end p-3">
                  <div className="text-white">
                    <h3 className="text-lg font-bold">{game.name}</h3>
                    <p className="text-xs opacity-80">{game.category}</p>
                  </div>
                </div>
              </div>

              {/* Game Info */}
              <div className="flex-1">
                <p className="text-xs opacity-60 mb-2">{game.description}</p>
                <div className="flex justify-between items-center text-xs gap-2">
                  <span className="text-yellow-400 font-bold truncate">{game.xc}</span>
                  <span className="opacity-40 shrink-0">{game.players} players</span>
                </div>
              </div>

              {/* Play Button */}
              <button className="terminal-btn active w-full py-2 text-sm font-bold uppercase tracking-widest">
                launch_game
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Footer */}
      <div className="mt-3 text-center">
        <p className="text-[9px] opacity-40 uppercase tracking-wide">
          Play games to earn XC coins • Compete with friends • Unlock achievements
        </p>
      </div>
    </div>
  );
};

export default GamesView;
