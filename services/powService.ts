// Proof of Work Service for XitChat Mesh Security
export interface POWChallenge {
  id: string;
  difficulty: number;
  data: string;
  target: string;
  timestamp: number;
  expiresAt: number;
  purpose: 'authentication' | 'message' | 'transaction' | 'channel';
}

export interface POWSolution {
  challengeId: string;
  nonce: number;
  hash: string;
  solveTime: number;
  solverId: string;
}

export interface POWStats {
  totalChallenges: number;
  solvedChallenges: number;
  averageSolveTime: number;
  currentDifficulty: number;
  hashRate: number;
  lastSolution: POWSolution | null;
}

class POWService {
  private isEnabled = false;
  private currentChallenge: POWChallenge | null = null;
  private stats: POWStats = {
    totalChallenges: 0,
    solvedChallenges: 0,
    averageSolveTime: 0,
    currentDifficulty: 1,
    hashRate: 0,
    lastSolution: null
  };
  private workers: Worker[] = [];
  private listeners: { [key: string]: ((data: any) => void)[] } = {};
  private miningInterval: number | null = null;

  constructor() {
    this.loadSettings();
  }

  private loadSettings() {
    try {
      const saved = localStorage.getItem('pow_settings');
      if (saved) {
        const settings = JSON.parse(saved);
        this.isEnabled = settings.enabled || false;
        this.stats.currentDifficulty = settings.difficulty || 1;
        if (this.isEnabled) {
          this.startPOW();
        }
      }
    } catch (error) {
      console.error('Failed to load POW settings:', error);
    }
  }

  private saveSettings() {
    localStorage.setItem('pow_settings', JSON.stringify({
      enabled: this.isEnabled,
      difficulty: this.stats.currentDifficulty,
      stats: this.stats
    }));
  }

  async enablePOW(): Promise<boolean> {
    try {
      this.isEnabled = true;
      await this.startPOW();
      this.saveSettings();
      this.notifyListeners('powEnabled', true);
      return true;
    } catch (error) {
      console.error('Failed to enable POW:', error);
      return false;
    }
  }

  async disablePOW(): Promise<boolean> {
    try {
      this.isEnabled = false;
      await this.stopPOW();
      this.saveSettings();
      this.notifyListeners('powDisabled', true);
      return true;
    } catch (error) {
      console.error('Failed to disable POW:', error);
      return false;
    }
  }

  private async startPOW(): Promise<void> {
    console.log('Starting POW service...');
    
    // Create web workers for mining
    this.createWorkers();
    
    // Start continuous mining for network security
    this.miningInterval = window.setInterval(() => {
      this.generateChallenge('authentication');
    }, 30000); // Every 30 seconds
    
    this.updateStats();
  }

  private async stopPOW(): Promise<void> {
    console.log('Stopping POW service...');
    
    if (this.miningInterval) {
      clearInterval(this.miningInterval);
      this.miningInterval = null;
    }
    
    // Terminate workers
    this.workers.forEach(worker => worker.terminate());
    this.workers = [];
    
    this.currentChallenge = null;
  }

  private createWorkers() {
    const workerCount = navigator.hardwareConcurrency || 4;
    
    for (let i = 0; i < workerCount; i++) {
      const workerCode = this.getWorkerCode();
      const blob = new Blob([workerCode], { type: 'application/javascript' });
      const workerUrl = URL.createObjectURL(blob);
      
      const worker = new Worker(workerUrl);
      
      worker.onmessage = (event) => {
        const { type, data } = event.data;
        
        if (type === 'solution') {
          this.handleSolution(data);
        } else if (type === 'hashRate') {
          this.updateHashRate(data.hashRate);
        }
      };
      
      this.workers.push(worker);
    }
  }

  private getWorkerCode(): string {
    const workerCode = `
      let currentChallenge = null;
      let startTime = 0;
      let hashes = 0;
      let lastHashRateUpdate = 0;

      self.onmessage = function(event) {
        const { type, data } = event.data;
        
        if (type === 'challenge') {
          currentChallenge = data;
          startTime = Date.now();
          hashes = 0;
          lastHashRateUpdate = Date.now();
          solveChallenge();
        }
      };

      function solveChallenge() {
        if (!currentChallenge) return;
        
        let nonce = 0;
        const target = currentChallenge.target;
        const data = currentChallenge.data;
        
        while (true) {
          const hash = hashFunction(data + nonce);
          hashes++;
          
          // Update hash rate every second
          if (Date.now() - lastHashRateUpdate > 1000) {
            const elapsed = (Date.now() - startTime) / 1000;
            const hashRate = hashes / elapsed;
            self.postMessage({ type: 'hashRate', data: { hashRate } });
            lastHashRateUpdate = Date.now();
          }
          
          if (hash.startsWith(target)) {
            const solveTime = Date.now() - startTime;
            self.postMessage({
              type: 'solution',
              data: {
                challengeId: currentChallenge.id,
                nonce,
                hash,
                solveTime,
                solverId: 'worker_' + Math.random().toString(36).substr(2, 9)
              }
            });
            break;
          }
          
          nonce++;
          
          // Check if challenge expired
          if (Date.now() > currentChallenge.expiresAt) {
            break;
          }
        }
      }

      function hashFunction(input) {
        // Simple hash function (in production, use proper crypto hash)
        let hash = 0;
        for (let i = 0; i < input.length; i++) {
          const char = input.charCodeAt(i);
          hash = ((hash << 5) - hash) + char;
          hash = hash & hash; // Convert to 32-bit integer
        }
        return Math.abs(hash).toString(16).padStart(8, '0');
      }
    `;
    
    return workerCode;
  }

  generateChallenge(purpose: POWChallenge['purpose']): POWChallenge {
    const challenge: POWChallenge = {
      id: `challenge_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      difficulty: this.stats.currentDifficulty,
      data: Math.random().toString(36),
      target: '0'.repeat(this.stats.currentDifficulty),
      timestamp: Date.now(),
      expiresAt: Date.now() + (5 * 60 * 1000), // 5 minutes
      purpose
    };

    this.currentChallenge = challenge;
    this.stats.totalChallenges++;
    
    // Send challenge to all workers
    this.workers.forEach(worker => {
      worker.postMessage({ type: 'challenge', data: challenge });
    });
    
    this.notifyListeners('challengeGenerated', challenge);
    return challenge;
  }

  private handleSolution(solution: POWSolution) {
    if (!this.currentChallenge || solution.challengeId !== this.currentChallenge.id) {
      return;
    }

    console.log(`POW solution found: ${solution.hash} (nonce: ${solution.nonce})`);
    
    this.stats.solvedChallenges++;
    this.stats.lastSolution = solution;
    
    // Update average solve time
    const totalSolveTime = this.stats.averageSolveTime * (this.stats.solvedChallenges - 1) + solution.solveTime;
    this.stats.averageSolveTime = totalSolveTime / this.stats.solvedChallenges;
    
    // Adjust difficulty based on solve time
    this.adjustDifficulty(solution.solveTime);
    
    this.notifyListeners('solutionFound', solution);
    this.saveSettings();
  }

  private updateHashRate(hashRate: number) {
    this.stats.hashRate = hashRate;
  }

  private adjustDifficulty(solveTime: number) {
    const targetTime = 10000; // 10 seconds target solve time
    
    if (solveTime < targetTime / 2) {
      // Too fast, increase difficulty
      this.stats.currentDifficulty = Math.min(8, this.stats.currentDifficulty + 1);
    } else if (solveTime > targetTime * 2) {
      // Too slow, decrease difficulty
      this.stats.currentDifficulty = Math.max(1, this.stats.currentDifficulty - 1);
    }
  }

  private updateStats() {
    if (!this.isEnabled) return;
    
    setInterval(() => {
      this.notifyListeners('statsUpdated', this.stats);
    }, 5000);
  }

  // PUBLIC API
  async verifyPOW(challengeId: string, nonce: number, hash: string): Promise<boolean> {
    if (!this.currentChallenge || this.currentChallenge.id !== challengeId) {
      return false;
    }

    // Verify the hash
    const expectedHash = this.hashFunction(this.currentChallenge.data + nonce);
    
    return hash === expectedHash && hash.startsWith(this.currentChallenge.target);
  }

  async requirePOW(purpose: POWChallenge['purpose'], data?: any): Promise<POWChallenge> {
    if (!this.isEnabled) {
      throw new Error('POW is not enabled');
    }

    return this.generateChallenge(purpose);
  }

  private hashFunction(input: string): string {
    let hash = 0;
    for (let i = 0; i < input.length; i++) {
      const char = input.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(16).padStart(8, '0');
  }

  // GETTERS
  getStats(): POWStats {
    return { ...this.stats };
  }

  getPOWEnabled(): boolean {
    return this.isEnabled;
  }

  getCurrentChallenge(): POWChallenge | null {
    return this.currentChallenge;
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

  // CLEANUP
  destroy() {
    this.stopPOW();
  }
}

export const powService = new POWService();
