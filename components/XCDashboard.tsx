import React, { useState, useEffect } from 'react';
import { xcEconomy, XCTransaction, XCAchievement } from '../services/xcEconomy';

interface XCDashboardProps {
  balance: number;
  onBack: () => void;
}

const XCDashboard: React.FC<XCDashboardProps> = ({ balance, onBack }) => {
  const [transactions, setTransactions] = useState<XCTransaction[]>([]);
  const [achievements, setAchievements] = useState<XCAchievement[]>([]);
  const [streak, setStreak] = useState<any>(null);
  const [stats, setStats] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'transactions' | 'achievements'>('overview');

  useEffect(() => {
    // Load data
    setTransactions(xcEconomy.getTransactions());
    setAchievements(xcEconomy.getAchievements());
    setStreak(xcEconomy.getStreak());
    setStats(xcEconomy.getStats());

    // Subscribe to updates
    const unsubscribeBalance = xcEconomy.subscribe('balanceUpdated', (newBalance) => {
      // Update parent balance if needed
    });

    const unsubscribeTransaction = xcEconomy.subscribe('transactionAdded', (transaction) => {
      setTransactions(xcEconomy.getTransactions());
      setStats(xcEconomy.getStats());
    });

    const unsubscribeAchievement = xcEconomy.subscribe('achievementCompleted', (achievement) => {
      setAchievements(xcEconomy.getAchievements());
      setStats(xcEconomy.getStats());
    });

    return () => {
      unsubscribeBalance();
      unsubscribeTransaction();
      unsubscribeAchievement();
    };
  }, []);

  const formatTimeAgo = (timestamp: number) => {
    const now = Date.now();
    const diff = now - timestamp;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    return `${days}d ago`;
  };

  const getTransactionIcon = (transaction: XCTransaction) => {
    switch (transaction.source) {
      case 'daily_bonus': return '🎁';
      case 'buzz_post': return '📝';
      case 'comment': return '💬';
      case 'interaction': return '❤️';
      case 'mesh_connection': return '🌐';
      case 'channel_join': return '📍';
      case 'profile_complete': return '👤';
      case 'achievement': return '🏆';
      case 'nodeshop': return '🛍️';
      default: return transaction.type === 'earn' ? '💰' : '💸';
    }
  };

  return (
    <div className="flex-1 p-6 overflow-y-auto bg-black text-current font-mono no-scrollbar">
      {/* Header */}
      <div className="flex items-center justify-between mb-8 border-b border-current pb-4">
        <div className="flex items-center gap-4">
          <button onClick={onBack} className="terminal-btn px-2 py-0 h-8 text-[10px] uppercase">back_to_hub</button>
          <div>
            <h2 className="text-lg font-bold uppercase tracking-tighter glow-text">xc_economy.exe</h2>
            <p className="text-[10px] font-bold opacity-50 uppercase tracking-widest text-white/30">virtual_currency_protocol</p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-[8px] font-bold opacity-50 uppercase tracking-widest text-white/40">xc_balance</p>
          <p className="text-2xl font-bold glow-text text-white">{balance} XC</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6 border-b border-current border-opacity-20 pb-4">
        {[
          { id: 'overview', label: 'OVERVIEW', icon: 'fa-chart-line' },
          { id: 'transactions', label: 'TRANSACTIONS', icon: 'fa-exchange-alt' },
          { id: 'achievements', label: 'ACHIEVEMENTS', icon: 'fa-trophy' }
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`terminal-btn px-4 h-8 text-[9px] uppercase tracking-widest transition-all flex items-center gap-2 ${
              activeTab === tab.id ? 'active' : 'opacity-40 hover:opacity-100'
            }`}
          >
            <i className={`fa-solid ${tab.icon}`}></i>
            {tab.label}
          </button>
        ))}
      </div>

      {/* Overview Tab */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* Stats Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="border border-current border-opacity-20 p-4 bg-[#050505]">
              <p className="text-[8px] font-bold opacity-30 uppercase tracking-widest mb-2">total_earned</p>
              <p className="text-xl font-bold text-green-400">{stats?.totalEarned || 0} XC</p>
            </div>
            <div className="border border-current border-opacity-20 p-4 bg-[#050505]">
              <p className="text-[8px] font-bold opacity-30 uppercase tracking-widest mb-2">total_spent</p>
              <p className="text-xl font-bold text-red-400">{stats?.totalSpent || 0} XC</p>
            </div>
            <div className="border border-current border-opacity-20 p-4 bg-[#050505]">
              <p className="text-[8px] font-bold opacity-30 uppercase tracking-widest mb-2">daily_streak</p>
              <p className="text-xl font-bold text-yellow-400">{streak?.currentStreak || 0} days</p>
            </div>
            <div className="border border-current border-opacity-20 p-4 bg-[#050505]">
              <p className="text-[8px] font-bold opacity-30 uppercase tracking-widest mb-2">achievements</p>
              <p className="text-xl font-bold text-purple-400">{stats?.achievementsCompleted || 0}/{achievements.length}</p>
            </div>
          </div>

          {/* Daily Bonus */}
          <div className="border border-current border-opacity-20 p-6 bg-[#050505]">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold uppercase">daily_bonus</h3>
              <span className="text-2xl">🎁</span>
            </div>
            <p className="text-sm opacity-60 mb-2">Login daily to earn XC!</p>
            <div className="flex items-center justify-between">
              <p className="text-xs opacity-40">Next bonus: {streak?.nextBonus || 10} XC</p>
              <p className="text-xs opacity-40">Streak: {streak?.currentStreak || 0} days</p>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="border border-current border-opacity-20 p-6 bg-[#050505]">
            <h3 className="text-lg font-bold uppercase mb-4">earn_xc</h3>
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="flex items-center gap-2">
                <span>📝</span>
                <span>Post Buzz (+5 XC)</span>
              </div>
              <div className="flex items-center gap-2">
                <span>💬</span>
                <span>Comment (+2 XC)</span>
              </div>
              <div className="flex items-center gap-2">
                <span>❤️</span>
                <span>Interact (+1 XC)</span>
              </div>
              <div className="flex items-center gap-2">
                <span>🌐</span>
                <span>Connect Node (+15 XC)</span>
              </div>
              <div className="flex items-center gap-2">
                <span>📍</span>
                <span>Join Channel (+3 XC)</span>
              </div>
              <div className="flex items-center gap-2">
                <span>👤</span>
                <span>Complete Profile (+20 XC)</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Transactions Tab */}
      {activeTab === 'transactions' && (
        <div className="space-y-4">
          <h3 className="text-lg font-bold uppercase mb-4">recent_transactions</h3>
          {transactions.length === 0 ? (
            <div className="text-center py-8 opacity-40">
              <p className="text-sm">No transactions yet</p>
              <p className="text-xs mt-2">Start earning XC by posting buzz or completing achievements!</p>
            </div>
          ) : (
            transactions.slice(0, 20).map(transaction => (
              <div key={transaction.id} className="border border-current border-opacity-20 p-4 bg-[#050505] flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-xl">{getTransactionIcon(transaction)}</span>
                  <div>
                    <p className="text-sm font-bold">{transaction.description}</p>
                    <p className="text-xs opacity-40">{formatTimeAgo(transaction.timestamp)}</p>
                  </div>
                </div>
                <div className={`text-right ${transaction.type === 'earn' ? 'text-green-400' : 'text-red-400'}`}>
                  <p className="font-bold">{transaction.type === 'earn' ? '+' : ''}{transaction.amount} XC</p>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Achievements Tab */}
      {activeTab === 'achievements' && (
        <div className="space-y-4">
          <h3 className="text-lg font-bold uppercase mb-4">achievements</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {achievements.map(achievement => (
              <div 
                key={achievement.id} 
                className={`border border-current border-opacity-20 p-4 bg-[#050505] ${
                  achievement.completed ? 'border-green-500/50 bg-green-500/5' : ''
                }`}
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{achievement.icon}</span>
                    <div>
                      <h4 className="text-sm font-bold">{achievement.name}</h4>
                      <p className="text-xs opacity-60">{achievement.description}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-yellow-400">+{achievement.reward} XC</p>
                    {achievement.completed && (
                      <p className="text-xs text-green-400">✓ COMPLETED</p>
                    )}
                  </div>
                </div>
                {!achievement.completed && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="opacity-60">Progress</span>
                      <span>{achievement.progress}/{achievement.maxProgress}</span>
                    </div>
                    <div className="w-full bg-black border border-current border-opacity-20 rounded-full overflow-hidden">
                      <div 
                        className="h-2 bg-current transition-all duration-500"
                        style={{ width: `${(achievement.progress / achievement.maxProgress) * 100}%` }}
                      ></div>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default XCDashboard;
