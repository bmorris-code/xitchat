
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
  const [isSyncing, setIsSyncing] = useState(false);

  useEffect(() => {
    // Load initial data
    refreshData();

    // Subscribe to updates
    const unsubscribeBalance = xcEconomy.subscribe('balanceUpdated', () => {
      refreshData();
    });

    const unsubscribeTransaction = xcEconomy.subscribe('transactionAdded', () => {
      refreshData();
      setIsSyncing(true);
      setTimeout(() => setIsSyncing(false), 2000);
    });

    const unsubscribeAchievement = xcEconomy.subscribe('achievementCompleted', () => {
      refreshData();
    });

    return () => {
      unsubscribeBalance();
      unsubscribeTransaction();
      unsubscribeAchievement();
    };
  }, []);

  const refreshData = () => {
    setTransactions(xcEconomy.getTransactions());
    setAchievements(xcEconomy.getAchievements());
    setStreak(xcEconomy.getStreak());
    setStats(xcEconomy.getStats());
  };

  const formatTimeAgo = (timestamp: number) => {
    const now = Date.now();
    const diff = now - timestamp;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return 'JUST_NOW';
    if (minutes < 60) return `${minutes}M_AGO`;
    if (hours < 24) return `${hours}H_AGO`;
    return `${days}D_AGO`;
  };

  const getTransactionIcon = (transaction: XCTransaction) => {
    switch (transaction.source) {
      case 'daily_bonus': return 'fa-gift';
      case 'buzz_post': return 'fa-pen-nib';
      case 'comment': return 'fa-comment-dots';
      case 'interaction': return 'fa-heart';
      case 'mesh_connection': return 'fa-network-wired';
      case 'channel_join': return 'fa-location-dot';
      case 'profile_complete': return 'fa-user-check';
      case 'achievement': return 'fa-trophy';
      case 'nodeshop': return 'fa-cart-shopping';
      default: return transaction.type === 'earn' ? 'fa-circle-plus' : 'fa-circle-minus';
    }
  };

  return (
    <div className="flex-1 flex flex-col bg-black text-current font-mono no-scrollbar animate-in fade-in duration-500">
      {/* Header */}
      <div className="p-6 border-b border-current border-opacity-30 bg-[#050505] relative overflow-hidden">
        {/* Animated background grid */}
        <div className="absolute inset-0 opacity-5 pointer-events-none bg-[linear-gradient(rgba(0,255,65,0.1)_1px,transparent_1px),linear-gradient(90deg,rgba(0,255,65,0.1)_1px,transparent_1px)] bg-[size:20px_20px]"></div>

        <div className="flex items-center justify-between relative z-10">
          <div className="flex items-center gap-6">
            <button
              onClick={onBack}
              className="terminal-btn px-4 py-1 text-[10px] uppercase font-bold"
            >
              &lt; exit_economy
            </button>
            <div>
              <h2 className="text-3xl font-black uppercase tracking-tighter glow-text text-white">xc_vault.sys</h2>
              <div className="flex items-center gap-3">
                <div className="w-2 h-2 bg-[#00ff41] rounded-full animate-pulse shadow-[0_0_8px_#00ff41]"></div>
                <p className="text-[10px] font-bold opacity-40 uppercase tracking-[0.3em] text-white/50">
                  {isSyncing ? 'syncing_ledger_with_nostr...' : 'secure_ledger_online'}
                </p>
              </div>
            </div>
          </div>
          <div className="text-right">
            <p className="text-[10px] font-black opacity-40 uppercase tracking-[0.4em] mb-1">available_credits</p>
            <div className="flex items-baseline justify-end gap-2">
              <span className="text-4xl font-black text-white glow-text">{balance}</span>
              <span className="text-sm font-bold text-[#00ff41]">XC</span>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="flex px-6 bg-[#020202] border-b border-current border-opacity-10">
        {[
          { id: 'overview', label: 'status_report', icon: 'fa-chart-simple' },
          { id: 'transactions', label: 'ledger_history', icon: 'fa-list-ul' },
          { id: 'achievements', label: 'milestones', icon: 'fa-award' }
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`px-6 py-4 text-[10px] font-bold uppercase tracking-[0.2em] transition-all relative flex items-center gap-3 ${activeTab === tab.id ? 'text-[#00ff41]' : 'opacity-30 hover:opacity-100 text-white'
              }`}
          >
            <i className={`fa-solid ${tab.icon} text-xs`}></i>
            {tab.label}
            {activeTab === tab.id && (
              <div className="absolute bottom-0 left-0 w-full h-0.5 bg-[#00ff41] shadow-[0_0_10px_#00ff41]"></div>
            )}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto p-8 no-scrollbar">
        {/* Overview Tab */}
        {activeTab === 'overview' && (
          <div className="space-y-8 animate-in slide-in-from-bottom-4 duration-500">
            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              {[
                { label: 'total_earned', value: `${stats?.totalEarned || 0} XC`, color: 'text-green-400', icon: 'fa-arrow-trend-up' },
                { label: 'total_spent', value: `${stats?.totalSpent || 0} XC`, color: 'text-red-500', icon: 'fa-arrow-trend-down' },
                { label: 'active_streak', value: `${streak?.currentStreak || 0} DAYS`, color: 'text-amber-500', icon: 'fa-fire-flame-curved' },
                { label: 'completion', value: `${stats?.achievementsCompleted || 0}/${achievements.length}`, color: 'text-purple-500', icon: 'fa-check-double' }
              ].map((stat, i) => (
                <div key={i} className="border border-current border-opacity-10 p-6 bg-[#050505] relative group hover:border-opacity-40 transition-all">
                  <div className="absolute top-2 right-2 opacity-10 group-hover:opacity-30 transition-opacity">
                    <i className={`fa-solid ${stat.icon} text-2xl`}></i>
                  </div>
                  <p className="text-[9px] font-black opacity-30 uppercase tracking-[0.3em] mb-3">{stat.label}</p>
                  <p className={`text-2xl font-black ${stat.color} tracking-tighter`}>{stat.value}</p>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {/* Daily Bonus Card */}
              <div className="border border-current border-opacity-10 p-8 bg-[#050505] relative overflow-hidden group">
                <div className="absolute -right-4 -bottom-4 opacity-5 group-hover:opacity-10 transition-opacity rotate-12">
                  <i className="fa-solid fa-gift text-9xl"></i>
                </div>
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-sm font-black uppercase tracking-[0.3em] text-white">daily_yield_protocol</h3>
                  <div className="w-10 h-10 rounded-full bg-amber-500/10 flex items-center justify-center text-amber-500 border border-amber-500/20">
                    <i className="fa-solid fa-gift"></i>
                  </div>
                </div>
                <p className="text-xs opacity-50 mb-8 leading-relaxed">Maintain your uplink streak to maximize daily XC rewards. Consistency is rewarded in the mesh.</p>
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-black/40 p-4 border border-current border-opacity-5">
                    <p className="text-[8px] opacity-30 uppercase mb-1">next_bonus</p>
                    <p className="text-lg font-bold text-white">+{streak?.nextBonus || 10} XC</p>
                  </div>
                  <div className="bg-black/40 p-4 border border-current border-opacity-5">
                    <p className="text-[8px] opacity-30 uppercase mb-1">active_streak</p>
                    <p className="text-lg font-bold text-white">{streak?.currentStreak || 0} DAYS</p>
                  </div>
                </div>
              </div>

              {/* Earning Guide */}
              <div className="border border-current border-opacity-10 p-8 bg-[#050505]">
                <h3 className="text-sm font-black uppercase tracking-[0.3em] text-white mb-6">mining_operations</h3>
                <div className="grid grid-cols-1 gap-4">
                  {[
                    { label: 'Post Buzz', reward: '+5 XC', icon: 'fa-pen-nib' },
                    { label: 'Connect Node', reward: '+15 XC', icon: 'fa-network-wired' },
                    { label: 'Complete Profile', reward: '+20 XC', icon: 'fa-user-check' },
                    { label: 'Social Interaction', reward: '+1 XC', icon: 'fa-heart' }
                  ].map((op, i) => (
                    <div key={i} className="flex items-center justify-between p-3 bg-black/40 border border-current border-opacity-5 group hover:border-opacity-30 transition-all">
                      <div className="flex items-center gap-4">
                        <i className={`fa-solid ${op.icon} text-xs opacity-40 group-hover:text-[#00ff41] group-hover:opacity-100 transition-all`}></i>
                        <span className="text-[10px] font-bold uppercase tracking-widest text-white/70">{op.label}</span>
                      </div>
                      <span className="text-[10px] font-black text-[#00ff41]">{op.reward}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Transactions Tab */}
        {activeTab === 'transactions' && (
          <div className="space-y-4 animate-in slide-in-from-bottom-4 duration-500">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-sm font-black uppercase tracking-[0.3em] text-white">transaction_ledger</h3>
              <span className="text-[9px] opacity-30 uppercase tracking-widest">showing_last_50_events</span>
            </div>

            {transactions.length === 0 ? (
              <div className="text-center py-20 border border-current border-opacity-5 bg-[#050505]">
                <i className="fa-solid fa-database text-4xl opacity-10 mb-4"></i>
                <p className="text-xs font-bold opacity-30 uppercase tracking-widest">no_ledger_entries_found</p>
              </div>
            ) : (
              <div className="space-y-3">
                {transactions.map(transaction => (
                  <div key={transaction.id} className="border border-current border-opacity-10 p-4 bg-[#050505] flex items-center justify-between group hover:border-opacity-40 transition-all">
                    <div className="flex items-center gap-5">
                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center border border-current border-opacity-10 ${transaction.type === 'earn' ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-500'
                        }`}>
                        <i className={`fa-solid ${getTransactionIcon(transaction)} text-sm`}></i>
                      </div>
                      <div>
                        <p className="text-[11px] font-bold text-white uppercase tracking-tight">{transaction.description}</p>
                        <p className="text-[9px] opacity-30 font-mono mt-1">{formatTimeAgo(transaction.timestamp)} • {transaction.source.toUpperCase()}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className={`text-sm font-black ${transaction.type === 'earn' ? 'text-green-400' : 'text-red-500'}`}>
                        {transaction.type === 'earn' ? '+' : ''}{transaction.amount} XC
                      </p>
                      <p className="text-[7px] opacity-20 font-mono mt-1">TXID_{transaction.id.substring(0, 8)}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Achievements Tab */}
        {activeTab === 'achievements' && (
          <div className="space-y-6 animate-in slide-in-from-bottom-4 duration-500">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-sm font-black uppercase tracking-[0.3em] text-white">milestone_matrix</h3>
              <span className="text-[9px] opacity-30 uppercase tracking-widest">unlock_rewards_via_mesh_activity</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {achievements.map(achievement => (
                <div
                  key={achievement.id}
                  className={`border p-6 bg-[#050505] relative overflow-hidden transition-all ${achievement.completed
                      ? 'border-[#00ff41] border-opacity-40 bg-[#00ff41]/5'
                      : 'border-current border-opacity-10'
                    }`}
                >
                  {achievement.completed && (
                    <div className="absolute -right-6 -top-6 w-16 h-16 bg-[#00ff41] rotate-45 flex items-end justify-center pb-1 shadow-[0_0_20px_rgba(0,255,65,0.4)]">
                      <i className="fa-solid fa-check text-black text-[10px] font-black -rotate-45"></i>
                    </div>
                  )}

                  <div className="flex items-start gap-6 mb-6">
                    <div className={`text-4xl ${achievement.completed ? 'opacity-100' : 'opacity-20 grayscale'}`}>
                      {achievement.icon}
                    </div>
                    <div className="flex-1">
                      <h4 className="text-xs font-black uppercase tracking-widest text-white mb-1">{achievement.name}</h4>
                      <p className="text-[10px] opacity-50 leading-relaxed">{achievement.description}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs font-black text-amber-500">+{achievement.reward} XC</p>
                    </div>
                  </div>

                  {!achievement.completed && (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between text-[9px] font-bold uppercase tracking-widest">
                        <span className="opacity-30">synchronization_progress</span>
                        <span className="text-white">{achievement.progress} / {achievement.maxProgress}</span>
                      </div>
                      <div className="w-full h-1 bg-white/5 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-[#00ff41] shadow-[0_0_10px_#00ff41] transition-all duration-1000 ease-out"
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
    </div>
  );
};

export default XCDashboard;
