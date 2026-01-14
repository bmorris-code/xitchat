// XC Economy Service - Virtual Currency System
export interface XCTransaction {
  id: string;
  type: 'earn' | 'spend' | 'bonus' | 'achievement';
  amount: number;
  description: string;
  timestamp: number;
  source: string;
}

export interface XCAchievement {
  id: string;
  name: string;
  description: string;
  reward: number;
  completed: boolean;
  progress: number;
  maxProgress: number;
  icon: string;
}

export interface XCStreak {
  currentStreak: number;
  lastActiveDate: string;
  totalDays: number;
  nextBonus: number;
}

class XCEconomyService {
  private balance: number = 0;
  private transactions: XCTransaction[] = [];
  private achievements: XCAchievement[] = [];
  private streak: XCStreak = {
    currentStreak: 0,
    lastActiveDate: '',
    totalDays: 0,
    nextBonus: 10
  };
  private listeners: { [key: string]: ((data: any) => void)[] } = {};

  constructor() {
    this.loadState();
    this.initializeAchievements();
    this.checkDailyStreak();
  }

  private loadState() {
    try {
      const saved = localStorage.getItem('xc_economy');
      if (saved) {
        const data = JSON.parse(saved);
        this.balance = data.balance || 0;
        this.transactions = data.transactions || [];
        this.streak = data.streak || this.streak;
      }
    } catch (error) {
      console.error('Failed to load XC economy state:', error);
    }
  }

  private saveState() {
    localStorage.setItem('xc_economy', JSON.stringify({
      balance: this.balance,
      transactions: this.transactions,
      streak: this.streak
    }));
  }

  private initializeAchievements() {
    this.achievements = [
      {
        id: 'first_post',
        name: 'First Steps',
        description: 'Post your first buzz message',
        reward: 25,
        completed: false,
        progress: 0,
        maxProgress: 1,
        icon: '📝'
      },
      {
        id: 'buzz_master',
        name: 'Buzz Master',
        description: 'Post 10 buzz messages',
        reward: 50,
        completed: false,
        progress: 0,
        maxProgress: 10,
        icon: '🎯'
      },
      {
        id: 'social_butterfly',
        name: 'Social Butterfly',
        description: 'Interact 100 times',
        reward: 100,
        completed: false,
        progress: 0,
        maxProgress: 100,
        icon: '🦋'
      },
      {
        id: 'mesh_pioneer',
        name: 'Mesh Pioneer',
        description: 'Connect to 10 mesh nodes',
        reward: 75,
        completed: false,
        progress: 0,
        maxProgress: 10,
        icon: '🌐'
      },
      {
        id: 'channel_hopper',
        name: 'Channel Hopper',
        description: 'Join 5 geohash channels',
        reward: 30,
        completed: false,
        progress: 0,
        maxProgress: 5,
        icon: '📍'
      },
      {
        id: 'profile_complete',
        name: 'Profile Complete',
        description: 'Complete your profile setup',
        reward: 20,
        completed: false,
        progress: 0,
        maxProgress: 4,
        icon: '👤'
      },
      {
        id: 'daily_warrior',
        name: 'Daily Warrior',
        description: 'Login for 7 consecutive days',
        reward: 100,
        completed: false,
        progress: 0,
        maxProgress: 7,
        icon: '🗓️'
      },
      {
        id: 'xc_collector',
        name: 'XC Collector',
        description: 'Earn 500 XC total',
        reward: 200,
        completed: false,
        progress: 0,
        maxProgress: 500,
        icon: '💰'
      }
    ];
  }

  private checkDailyStreak() {
    const today = new Date().toDateString();
    const lastActive = this.streak.lastActiveDate;
    
    if (lastActive !== today) {
      const yesterday = new Date(Date.now() - 86400000).toDateString();
      
      if (lastActive === yesterday) {
        // Continue streak
        this.streak.currentStreak++;
        this.streak.totalDays++;
        this.streak.nextBonus = Math.min(10 + this.streak.currentStreak * 5, 50);
      } else {
        // Reset streak
        this.streak.currentStreak = 1;
        this.streak.nextBonus = 10;
      }
      
      this.streak.lastActiveDate = today;
      
      // Award daily bonus
      this.addXC(this.streak.nextBonus, 'Daily Login Bonus', 'daily_bonus');
      
      // Check streak achievement
      this.updateAchievement('daily_warrior', this.streak.currentStreak);
      
      this.saveState();
    }
  }

  // PUBLIC API
  getBalance(): number {
    return this.balance;
  }

  getTransactions(): XCTransaction[] {
    return this.transactions.sort((a, b) => b.timestamp - a.timestamp);
  }

  getAchievements(): XCAchievement[] {
    return this.achievements;
  }

  getStreak(): XCStreak {
    return this.streak;
  }

  addXC(amount: number, description: string, source: string): boolean {
    if (amount <= 0) return false;
    
    this.balance += amount;
    
    const transaction: XCTransaction = {
      id: Date.now().toString(),
      type: 'earn',
      amount,
      description,
      timestamp: Date.now(),
      source
    };
    
    this.transactions.push(transaction);
    
    // Update XC collector achievement
    this.updateAchievement('xc_collector', this.balance);
    
    this.saveState();
    this.notifyListeners('balanceUpdated', this.balance);
    this.notifyListeners('transactionAdded', transaction);
    
    return true;
  }

  spendXC(amount: number, description: string, source: string): boolean {
    if (amount <= 0 || this.balance < amount) return false;
    
    this.balance -= amount;
    
    const transaction: XCTransaction = {
      id: Date.now().toString(),
      type: 'spend',
      amount: -amount,
      description,
      timestamp: Date.now(),
      source
    };
    
    this.transactions.push(transaction);
    
    this.saveState();
    this.notifyListeners('balanceUpdated', this.balance);
    this.notifyListeners('transactionAdded', transaction);
    
    return true;
  }

  // EARNING METHODS
  awardDailyLogin(): void {
    this.checkDailyStreak();
  }

  awardBuzzPost(): void {
    this.addXC(5, 'Posted buzz message', 'buzz_post');
    this.updateAchievement('first_post', 1);
    this.updateAchievement('buzz_master', 1);
  }

  awardComment(): void {
    this.addXC(2, 'Posted comment', 'comment');
    this.updateAchievement('social_butterfly', 1);
  }

  awardInteraction(): void {
    this.addXC(1, 'Social interaction', 'interaction');
    this.updateAchievement('social_butterfly', 1);
  }

  awardMeshConnection(): void {
    this.addXC(15, 'Connected to mesh node', 'mesh_connection');
    this.updateAchievement('mesh_pioneer', 1);
  }

  awardChannelJoin(): void {
    this.addXC(3, 'Joined geohash channel', 'channel_join');
    this.updateAchievement('channel_hopper', 1);
  }

  awardProfileComplete(): void {
    this.addXC(20, 'Completed profile setup', 'profile_complete');
    this.updateAchievement('profile_complete', 1);
  }

  awardAchievement(achievementId: string): void {
    const achievement = this.achievements.find(a => a.id === achievementId);
    if (achievement && !achievement.completed) {
      this.addXC(achievement.reward, `Achievement: ${achievement.name}`, 'achievement');
      achievement.completed = true;
      this.saveState();
      this.notifyListeners('achievementCompleted', achievement);
    }
  }

  private updateAchievement(achievementId: string, increment: number): void {
    const achievement = this.achievements.find(a => a.id === achievementId);
    if (achievement && !achievement.completed) {
      achievement.progress = Math.min(achievement.progress + increment, achievement.maxProgress);
      
      if (achievement.progress >= achievement.maxProgress) {
        this.awardAchievement(achievementId);
      }
      
      this.saveState();
      this.notifyListeners('achievementUpdated', achievement);
    }
  }

  // EVENT LISTENERS
  subscribe(event: string, callback: (data: any) => void): () => void {
    if (!this.listeners[event]) {
      this.listeners[event] = [];
    }
    this.listeners[event].push(callback);
    
    return () => {
      this.listeners[event] = this.listeners[event].filter(cb => cb !== callback);
    };
  }

  private notifyListeners(event: string, data: any) {
    if (this.listeners[event]) {
      this.listeners[event].forEach(callback => callback(data));
    }
  }

  // ADMIN METHODS (for testing/debugging)
  debugAddXC(amount: number): void {
    this.addXC(amount, 'Debug addition', 'debug');
  }

  getStats() {
    return {
      balance: this.balance,
      totalEarned: this.transactions.filter(t => t.type === 'earn').reduce((sum, t) => sum + t.amount, 0),
      totalSpent: Math.abs(this.transactions.filter(t => t.type === 'spend').reduce((sum, t) => sum + t.amount, 0)),
      transactionCount: this.transactions.length,
      achievementsCompleted: this.achievements.filter(a => a.completed).length,
      currentStreak: this.streak.currentStreak
    };
  }
}

export const xcEconomy = new XCEconomyService();
